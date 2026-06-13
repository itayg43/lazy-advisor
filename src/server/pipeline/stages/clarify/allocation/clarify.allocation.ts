import { InternalError, InternalSchemaValidationError } from "#errors";
import { createLogger } from "#lib/logger";
import { parseSchema } from "#lib/parse-schema";
import {
  HandlerOutputKind,
  runConversation,
  type InitHandler,
  type TurnHandler,
} from "#pipeline/run-conversation";
import {
  ALLOCATION_ANCHOR_DATA,
  ALLOCATION_MISSING_COUNTER_MESSAGE,
  ALLOCATION_UNKNOWN_INTENT_MESSAGE,
  MAX_NEGOTIATION_TURNS,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import {
  classifyTurn,
  composeCounterReply,
  composeQuestionReply,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.io";
import {
  applyBranchFraming,
  calculateBufferPercentage,
  computeSplit,
  deriveAnchorEquityPercentage,
  formatCurrency,
  isAcceptKind,
  selectCounterBranch,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.lib";
import {
  AllocationIntentKindEnum,
  AllocationPhaseOutputSchema,
  AllocationPhaseResultSchema,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type {
  AllocationAcceptIntentKind,
  AllocationAskDecision,
  AllocationFramingFlags,
  AllocationHandlerOutput,
  AllocationIntentKind,
  AllocationNegotiationState,
  AllocationPhaseInput,
  AllocationPhaseResult,
  AllocationProposalContext,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyAllocation");

type ResolveAskDecisionArgs = {
  kind: Exclude<AllocationIntentKind, AllocationAcceptIntentKind>;
  proposedEquityPercentage: number | null;
  state: Readonly<AllocationNegotiationState>;
  proposalContext: AllocationProposalContext;
  lastUserResponse: string;
};

const buildInitialProposal = (amount: number, equityPercentage: number): string => {
  const { equityAmount, bufferAmount } = computeSplit(amount, equityPercentage);
  const bufferPercentage = calculateBufferPercentage(equityPercentage);

  return `Based on your timeline and comfort with drops, I'd propose ${formatCurrency(equityAmount)} in stock ETFs and ${formatCurrency(bufferAmount)} in a buffer — roughly ${equityPercentage}/${bufferPercentage}.
More in stocks means bigger drops in bad years and higher long-run growth; less in stocks means smaller drops and lower growth.
Sizing to your comfort level tends to reduce the chance of panic-selling when drops happen.
Want that split, more in stocks, or more in buffer?`;
};

const handleAcceptTurn = (
  intentKind: AllocationAcceptIntentKind,
  equityPercentages: {
    currentEquityPercentage: number;
    anchorEquityPercentage: number;
  },
): AllocationHandlerOutput => {
  const { currentEquityPercentage, anchorEquityPercentage } = equityPercentages;

  const finalEquityPercentage =
    intentKind === AllocationIntentKindEnum.enum["accept-original"]
      ? anchorEquityPercentage
      : currentEquityPercentage;

  // Inner fail-fast: a bug in the accept path surfaces here, not downstream.
  // Overlaps the outer result parse on purpose. No logging — the `runClarify`
  // catch logs `BaseError`s once.
  const output = parseSchema(
    AllocationPhaseOutputSchema,
    {
      equityPercentage: finalEquityPercentage,
      bufferPercentage: calculateBufferPercentage(finalEquityPercentage),
    },
    (error, value) =>
      new InternalSchemaValidationError(
        "Allocation phase produced an output that failed schema validation",
        error,
        value,
      ),
  );

  logger.info("Accepted allocation", { intentKind, ...output });

  return {
    kind: HandlerOutputKind.Done,
    result: { status: PipelineStatusEnum.enum.completed, ...output },
  };
};

const handleCounterTurn = async (
  proposedEquityPercentage: number | null,
  state: Readonly<AllocationNegotiationState>,
  proposalContext: AllocationProposalContext,
): Promise<AllocationAskDecision> => {
  if (proposedEquityPercentage === null) {
    logger.warn(
      "Counter intent without proposedEquityPercentage — re-asking for a specific split",
    );

    return {
      kind: HandlerOutputKind.Ask,
      message: ALLOCATION_MISSING_COUNTER_MESSAGE,
    };
  }

  const previousEquityPercentage = state.currentEquityPercentage;
  const currentFramingFlags: AllocationFramingFlags = {
    hasShownExtremeFraming: state.hasShownExtremeFraming,
    hasShownCompoundImpactFraming: state.hasShownCompoundImpactFraming,
  };
  const counterBranch = selectCounterBranch(
    proposedEquityPercentage,
    proposalContext.suggestedEquityRange,
    currentFramingFlags,
  );
  const nextFramingFlags = applyBranchFraming(currentFramingFlags, counterBranch);

  logger.info("Resolved counter turn", {
    counterBranch,
    previousEquityPercentage,
    proposedEquityPercentage,
    currentFramingFlags,
    nextFramingFlags,
  });

  const reply = await composeCounterReply(
    counterBranch,
    { proposedEquityPercentage, previousEquityPercentage },
    proposalContext,
  );

  // `nextFramingFlags` rides in the patch, which the runner commits only after
  // `reply` is sent — so a framing is never marked shown on an undelivered turn.
  // (Atomicity note in run-conversation.ts.)
  return {
    kind: HandlerOutputKind.Ask,
    message: reply,
    statePatch: {
      currentEquityPercentage: proposedEquityPercentage,
      ...nextFramingFlags,
    },
  };
};

const handleQuestionTurn = async (
  lastUserResponse: string,
  currentEquityPercentage: number,
  proposalContext: AllocationProposalContext,
): Promise<AllocationAskDecision> => {
  const reply = await composeQuestionReply(
    lastUserResponse,
    currentEquityPercentage,
    proposalContext,
  );

  return { kind: HandlerOutputKind.Ask, message: reply };
};

const createInitHandler =
  (
    amount: number,
    anchorEquityPercentage: number,
  ): InitHandler<AllocationNegotiationState, AllocationPhaseResult> =>
  async (): Promise<AllocationHandlerOutput> => ({
    kind: HandlerOutputKind.Ask,
    state: {
      currentEquityPercentage: anchorEquityPercentage,
      hasShownExtremeFraming: false,
      hasShownCompoundImpactFraming: false,
      turnsTaken: 0,
    },
    message: buildInitialProposal(amount, anchorEquityPercentage),
  });

// Routes a *continuing* intent to the Ask reply it produces. The terminal
// intents (accept / budget exhaustion) are resolved in `createTurnHandler`
// before this runs, so every branch here returns Ask.
const resolveAskDecision = async (
  args: ResolveAskDecisionArgs,
): Promise<AllocationAskDecision> => {
  const { kind, proposedEquityPercentage, state, proposalContext, lastUserResponse } =
    args;

  switch (kind) {
    case AllocationIntentKindEnum.enum.counter:
      return handleCounterTurn(proposedEquityPercentage, state, proposalContext);
    case AllocationIntentKindEnum.enum.question:
      return handleQuestionTurn(
        lastUserResponse,
        state.currentEquityPercentage,
        proposalContext,
      );
    case AllocationIntentKindEnum.enum.unknown: {
      logger.warn("Unknown allocation intent — re-asking with the generic prompt");

      return {
        kind: HandlerOutputKind.Ask,
        message: ALLOCATION_UNKNOWN_INTENT_MESSAGE,
      };
    }

    default: {
      const _exhaustive: never = kind;

      throw new InternalError(
        `resolveAskDecision: unhandled intent kind: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
};

const createTurnHandler =
  (
    proposalContext: AllocationProposalContext,
    anchorEquityPercentage: number,
  ): TurnHandler<AllocationNegotiationState, AllocationPhaseResult> =>
  async (state, history, lastUserResponse): Promise<AllocationHandlerOutput> => {
    const turnsTaken = state.turnsTaken + 1;

    const intent = await classifyTurn(history);
    const { kind } = intent;

    // Accept is checked before the budget gate on purpose: a user who accepts
    // on the final turn should complete the phase, not be failed as exhausted.
    if (isAcceptKind(kind)) {
      return handleAcceptTurn(kind, {
        currentEquityPercentage: state.currentEquityPercentage,
        anchorEquityPercentage,
      });
    }

    if (turnsTaken >= MAX_NEGOTIATION_TURNS) {
      logger.warn("Allocation phase unresolved — turn budget exhausted");

      return {
        kind: HandlerOutputKind.Done,
        result: {
          status: PipelineStatusEnum.enum.unresolved,
          reason: ClarifyUnresolvedReasonEnum.enum.allocation,
        },
      };
    }

    const { message, statePatch } = await resolveAskDecision({
      kind,
      proposedEquityPercentage: intent.proposedEquityPercentage,
      state,
      proposalContext,
      lastUserResponse,
    });

    // Ask decisions carry only a state patch — this is the single place that
    // applies the `turnsTaken` increment and lifts that patch into the full
    // successor state the runner needs.
    return {
      kind: HandlerOutputKind.Ask,
      state: { ...state, turnsTaken, ...statePatch },
      message,
    };
  };

export const collectAllocation = async (
  input: AllocationPhaseInput,
  responder: Responder,
): Promise<AllocationPhaseResult> => {
  logger.info("Starting allocation phase", { input });

  const { amount, timeline, riskTolerance, riskSelfRatingScore } = input;

  const suggestedEquityRange = ALLOCATION_ANCHOR_DATA[riskTolerance][timeline];
  const anchorEquityPercentage = deriveAnchorEquityPercentage(
    suggestedEquityRange,
    riskSelfRatingScore,
  );

  logger.info("Derived allocation anchor", {
    suggestedEquityRange,
    anchorEquityPercentage,
  });

  // Outer boundary over the whole result — mirrors the inner accept-path parse,
  // but also covers the unresolved arm, which has no upstream fail-fast check.
  const result = parseSchema(
    AllocationPhaseResultSchema,
    await runConversation({
      initHandler: createInitHandler(amount, anchorEquityPercentage),
      turnHandler: createTurnHandler(
        { amount, timeline, suggestedEquityRange },
        anchorEquityPercentage,
      ),
      responder,
      // Backstop only. Legitimate asks max at exactly MAX_NEGOTIATION_TURNS (the
      // init ask offsets the final budget-exhausted Done), so +1 never false-trips
      // — it absorbs an off-by-one in the handler's turn accounting while still
      // catching a runaway handler one turn later.
      hardStopTurns: MAX_NEGOTIATION_TURNS + 1,
    }),
    (error, value) =>
      new InternalSchemaValidationError(
        "Allocation phase produced a result that failed schema validation",
        error,
        value,
      ),
  );

  logger.info("Completed allocation phase", { result });

  return result;
};
