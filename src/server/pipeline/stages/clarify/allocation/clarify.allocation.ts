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
  ALLOCATION_UNKNOWN_INTENT_MESSAGE,
  ALLOCATION_MAX_NEGOTIATION_TURNS,
  ALLOCATION_MAX_TOTAL_TURNS,
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
  formatCurrency,
  isAcceptIntent,
  resolveAllocationAnchor,
  selectCounterBranch,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.lib";
import {
  AllocationIntentKindEnum,
  AllocationPhaseOutputSchema,
  AllocationPhaseResultSchema,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type {
  AllocationAcceptDecision,
  AllocationAcceptIntentKind,
  AllocationAskDecision,
  AllocationContinuingIntent,
  AllocationConversationState,
  AllocationFramingFlags,
  AllocationHandlerOutput,
  AllocationInitHandlerOutput,
  AllocationNegotiationState,
  AllocationPhaseInput,
  AllocationPhaseResult,
  AllocationProposalContext,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyAllocation");

type ResolveAskDecisionParams = {
  intent: AllocationContinuingIntent;
  negotiationState: Readonly<AllocationNegotiationState>;
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
): AllocationAcceptDecision => {
  const { currentEquityPercentage, anchorEquityPercentage } = equityPercentages;

  const finalEquityPercentage =
    intentKind === AllocationIntentKindEnum.enum["accept-original"]
      ? anchorEquityPercentage
      : currentEquityPercentage;

  // Inner fail-fast: a bug in the accept path surfaces here, not downstream.
  // Overlaps the outer result parse on purpose. No logging — the
  // `runClarifyOrchestrator` catch logs `BaseError`s once.
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
  proposedEquityPercentage: number,
  negotiationState: Readonly<AllocationNegotiationState>,
  proposalContext: AllocationProposalContext,
): Promise<AllocationAskDecision> => {
  const previousEquityPercentage = negotiationState.currentEquityPercentage;
  const currentFramingFlags: AllocationFramingFlags = {
    hasShownExtremeFraming: negotiationState.hasShownExtremeFraming,
    hasShownCompoundImpactFraming: negotiationState.hasShownCompoundImpactFraming,
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
    negotiationStatePatch: {
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
  ): InitHandler<AllocationConversationState, AllocationPhaseResult> =>
  async (): Promise<AllocationInitHandlerOutput> => ({
    kind: HandlerOutputKind.Ask,
    state: {
      totalTurnsTaken: 0,
      negotiation: {
        currentEquityPercentage: anchorEquityPercentage,
        hasShownExtremeFraming: false,
        hasShownCompoundImpactFraming: false,
        negotiationTurnsTaken: 0,
      },
    },
    message: buildInitialProposal(amount, anchorEquityPercentage),
  });

// Routes a *continuing* intent to the Ask reply it produces. The terminal
// intents (accept / budget exhaustion) are resolved in `createTurnHandler`
// before this runs, so every branch here returns Ask.
const resolveAskDecision = async (
  params: ResolveAskDecisionParams,
): Promise<AllocationAskDecision> => {
  const { intent, negotiationState, proposalContext, lastUserResponse } = params;

  switch (intent.kind) {
    case AllocationIntentKindEnum.enum.counter:
      return handleCounterTurn(
        intent.proposedEquityPercentage,
        negotiationState,
        proposalContext,
      );
    case AllocationIntentKindEnum.enum.question:
      return handleQuestionTurn(
        lastUserResponse,
        negotiationState.currentEquityPercentage,
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
      const _exhaustive: never = intent;

      throw new InternalError(
        `resolveAskDecision: unhandled intent: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
};

const createTurnHandler =
  (
    proposalContext: AllocationProposalContext,
    anchorEquityPercentage: number,
  ): TurnHandler<AllocationConversationState, AllocationPhaseResult> =>
  async (
    conversationState,
    history,
    lastUserResponse,
  ): Promise<AllocationHandlerOutput> => {
    const { totalTurnsTaken, negotiation } = conversationState;

    const intent = await classifyTurn(history);

    // Accept is checked before either budget gate on purpose: a user who accepts
    // on the final turn should complete the phase, not be failed as exhausted.
    if (isAcceptIntent(intent)) {
      return handleAcceptTurn(intent.kind, {
        currentEquityPercentage: negotiation.currentEquityPercentage,
        anchorEquityPercentage,
      });
    }

    // Total-turn backstop — counts every reply type, so a user who mostly asks
    // clarifying questions exits gracefully here instead of climbing into the
    // runner's 500-level hard stop. `>=` cuts once the budget is spent.
    if (totalTurnsTaken >= ALLOCATION_MAX_TOTAL_TURNS) {
      logger.warn("Allocation phase unresolved — total turn budget exhausted");

      return {
        kind: HandlerOutputKind.Done,
        result: { status: PipelineStatusEnum.enum.unresolved },
      };
    }

    // Negotiation budget — only counter-proposals count, and we gate before
    // composing so a refused counter never spends a composer call.
    const isCounterIntent = intent.kind === AllocationIntentKindEnum.enum.counter;
    if (
      isCounterIntent &&
      negotiation.negotiationTurnsTaken >= ALLOCATION_MAX_NEGOTIATION_TURNS
    ) {
      logger.warn("Allocation phase unresolved — negotiation budget exhausted");

      return {
        kind: HandlerOutputKind.Done,
        result: { status: PipelineStatusEnum.enum.unresolved },
      };
    }

    const { message, negotiationStatePatch } = await resolveAskDecision({
      intent,
      negotiationState: negotiation,
      proposalContext,
      lastUserResponse,
    });

    // The single place both turn counters commit and the negotiation patch is
    // lifted into the full successor state.
    return {
      kind: HandlerOutputKind.Ask,
      state: {
        totalTurnsTaken: totalTurnsTaken + 1,
        negotiation: {
          ...negotiation,
          ...negotiationStatePatch,
          negotiationTurnsTaken:
            negotiation.negotiationTurnsTaken + (isCounterIntent ? 1 : 0),
        },
      },
      message,
    };
  };

export const collectAllocation = async (
  input: AllocationPhaseInput,
  responder: Responder,
): Promise<AllocationPhaseResult> => {
  logger.info("Starting allocation phase", { input });

  const { amount, timeline, riskTolerance } = input;

  const { suggestedEquityRange, anchorEquityPercentage } = resolveAllocationAnchor(
    riskTolerance,
    timeline,
  );

  logger.info("Derived allocation anchor", {
    suggestedEquityRange,
    anchorEquityPercentage,
  });

  const conversationResult = await runConversation({
    initHandler: createInitHandler(amount, anchorEquityPercentage),
    turnHandler: createTurnHandler(
      { amount, timeline, suggestedEquityRange },
      anchorEquityPercentage,
    ),
    responder,
    // Backstop only, not the real limit — turn accounting lives in the phase
    // state and a well-formed handler returns Done first. The last legitimate
    // ask is emitted while `asksEmitted` equals ALLOCATION_MAX_TOTAL_TURNS, so
    // +1 clears it; only a handler that asks past its own total budget trips this.
    hardStopTurns: ALLOCATION_MAX_TOTAL_TURNS + 1,
  });

  // Outer boundary over the whole result — mirrors the inner accept-path parse,
  // but also covers the unresolved arm, which has no upstream fail-fast check.
  const result = parseSchema(
    AllocationPhaseResultSchema,
    conversationResult,
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
