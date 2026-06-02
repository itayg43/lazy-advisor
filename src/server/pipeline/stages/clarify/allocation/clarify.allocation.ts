import { InternalSchemaValidationError } from "#errors";
import { createLogger } from "#lib/logger";
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
  calculateBufferPercentage,
  computeSplit,
  deriveAnchorEquityPercentage,
  formatCurrency,
  isAcceptKind,
  selectCounterBranch,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.lib";
import {
  AllocationCounterBranchKindEnum,
  AllocationIntentKindEnum,
  AllocationPhaseResultSchema,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type {
  AllocationAcceptIntentKind,
  AllocationAskDecision,
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

const buildInitialProposal = (
  amount: number,
  equityPercentage: number,
  bufferPercentage: number,
): string => {
  const { equityAmount, bufferAmount } = computeSplit(amount, equityPercentage);

  return `Based on your timeline and comfort with drops, I'd propose ${formatCurrency(equityAmount)} in stock ETFs and ${formatCurrency(bufferAmount)} in a buffer — roughly ${equityPercentage}/${bufferPercentage}.
More in stocks means bigger drops in bad years and higher long-run growth; less in stocks means smaller drops and lower growth.
Sizing to your comfort level tends to reduce the chance of panic-selling when drops happen.
Want that split, more in stocks, or more in buffer?`;
};

const toBudgetExhaustedDone = (): AllocationHandlerOutput => {
  logger.warn("Allocation phase unresolved — turn budget exhausted");

  return {
    kind: HandlerOutputKind.Done,
    result: {
      status: PipelineStatusEnum.enum.unresolved,
      reason: ClarifyUnresolvedReasonEnum.enum.allocation,
    },
  };
};

const toMissingCounterAsk = (): AllocationAskDecision => {
  logger.warn(
    "Counter intent without proposedEquityPercentage — re-asking for a specific split",
  );

  return {
    kind: HandlerOutputKind.Ask,
    message: ALLOCATION_MISSING_COUNTER_MESSAGE,
  };
};

const toUnknownAsk = (): AllocationAskDecision => {
  logger.warn("Unknown allocation intent — re-asking with the generic prompt");

  return {
    kind: HandlerOutputKind.Ask,
    message: ALLOCATION_UNKNOWN_INTENT_MESSAGE,
  };
};

const handleAcceptTurn = (
  intentKind: AllocationAcceptIntentKind,
  currentEquityPercentage: number,
  anchorEquityPercentage: number,
): AllocationHandlerOutput => {
  const finalEquityPercentage =
    intentKind === AllocationIntentKindEnum.enum["accept-original"]
      ? anchorEquityPercentage
      : currentEquityPercentage;

  logger.info("Accepted allocation", { intentKind, finalEquityPercentage });

  return {
    kind: HandlerOutputKind.Done,
    result: {
      status: PipelineStatusEnum.enum.completed,
      equityPercentage: finalEquityPercentage,
      bufferPercentage: calculateBufferPercentage(finalEquityPercentage),
    },
  };
};

const handleCounterTurn = async (
  proposedEquityPercentage: number | null,
  state: Readonly<AllocationNegotiationState>,
  ctx: AllocationProposalContext,
): Promise<AllocationAskDecision> => {
  if (proposedEquityPercentage === null) return toMissingCounterAsk();

  const {
    currentEquityPercentage: previousEquityPercentage,
    hasShownExtremeFraming,
    hasShownCompoundImpactFraming,
  } = state;

  const branch = selectCounterBranch(
    proposedEquityPercentage,
    ctx.suggestedEquityRange,
    hasShownExtremeFraming,
    hasShownCompoundImpactFraming,
  );

  logger.info("Selected counter branch", {
    branch,
    previousEquityPercentage,
    proposedEquityPercentage,
    hasShownExtremeFraming,
    hasShownCompoundImpactFraming,
  });

  const reply = await composeCounterReply(
    branch,
    proposedEquityPercentage,
    previousEquityPercentage,
    ctx,
  );

  // Framing flags are sticky — once a branch has been shown, it stays shown for
  // the rest of the phase so `selectCounterBranch` won't repeat it.
  return {
    kind: HandlerOutputKind.Ask,
    message: reply,
    statePatch: {
      currentEquityPercentage: proposedEquityPercentage,
      hasShownExtremeFraming:
        hasShownExtremeFraming ||
        branch.kind === AllocationCounterBranchKindEnum.enum.extreme,
      hasShownCompoundImpactFraming:
        hasShownCompoundImpactFraming ||
        branch.kind === AllocationCounterBranchKindEnum.enum["compound-impact"],
    },
  };
};

const handleQuestionTurn = async (
  lastUserResponse: string,
  currentEquityPercentage: number,
  ctx: AllocationProposalContext,
): Promise<AllocationAskDecision> => {
  const reply = await composeQuestionReply(
    lastUserResponse,
    currentEquityPercentage,
    ctx,
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
    message: buildInitialProposal(
      amount,
      anchorEquityPercentage,
      calculateBufferPercentage(anchorEquityPercentage),
    ),
  });

// Routes a *continuing* intent to the Ask reply it produces. The terminal
// intents (accept / budget exhaustion) are resolved in `createTurnHandler`
// before this runs, so every branch here returns Ask.
const resolveAskDecision = async (
  kind: Exclude<AllocationIntentKind, AllocationAcceptIntentKind>,
  proposedEquityPercentage: number | null,
  state: Readonly<AllocationNegotiationState>,
  ctx: AllocationProposalContext,
  lastUserResponse: string,
): Promise<AllocationAskDecision> => {
  switch (kind) {
    case AllocationIntentKindEnum.enum.counter:
      return handleCounterTurn(proposedEquityPercentage, state, ctx);
    case AllocationIntentKindEnum.enum.question:
      return handleQuestionTurn(lastUserResponse, state.currentEquityPercentage, ctx);
    case AllocationIntentKindEnum.enum.unknown:
      return toUnknownAsk();

    default: {
      const _exhaustive: never = kind;

      throw new Error(
        `resolveAskDecision: unhandled intent kind: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
};

const createTurnHandler =
  (
    ctx: AllocationProposalContext,
    anchorEquityPercentage: number,
  ): TurnHandler<AllocationNegotiationState, AllocationPhaseResult> =>
  async (state, history, lastUserResponse): Promise<AllocationHandlerOutput> => {
    const turnsTaken = state.turnsTaken + 1;

    const intent = await classifyTurn(history);
    const { kind } = intent;

    // Accept is checked before the budget gate on purpose: a user who accepts
    // on the final turn should complete the phase, not be failed as exhausted.
    if (isAcceptKind(kind))
      return handleAcceptTurn(
        kind,
        state.currentEquityPercentage,
        anchorEquityPercentage,
      );

    if (turnsTaken >= MAX_NEGOTIATION_TURNS) return toBudgetExhaustedDone();

    const { message, statePatch } = await resolveAskDecision(
      kind,
      intent.proposedEquityPercentage,
      state,
      ctx,
      lastUserResponse,
    );

    // Ask decisions carry only a state patch — this is the single place that
    // applies the `turnsTaken` increment and lifts that patch into the full
    // successor state the runner needs.
    return {
      kind: HandlerOutputKind.Ask,
      state: { ...state, turnsTaken, ...statePatch },
      message,
    };
  };

// Enforces the phase invariants (int 0–100, equity + buffer = 100) at the
// boundary. Takes `unknown` on purpose: this is a validation boundary, so it
// must not trust the static type. The split holds by construction today, so a
// failure is an internal bug, not malformed upstream data — surface it as a 500.
// Logs here because no error boundary consumes it yet; once one does (and logs
// `BaseError`s), this should throw silently to avoid double-logging.
const parseResult = (result: unknown): AllocationPhaseResult => {
  const parsed = AllocationPhaseResultSchema.safeParse(result);
  if (!parsed.success) {
    logger.error("Allocation phase result failed schema validation", parsed.error, {
      result,
      issues: parsed.error.issues,
    });

    throw new InternalSchemaValidationError(
      "Allocation phase produced a result that failed schema validation",
      parsed.error,
    );
  }

  return parsed.data;
};

export const collectAllocation = async (
  input: AllocationPhaseInput,
  responder: Responder,
): Promise<AllocationPhaseResult> => {
  const { amount, timeline, riskTolerance, riskSelfRatingScore } = input;

  logger.info("Starting allocation phase", {
    amount,
    timeline,
    riskTolerance,
    riskSelfRatingScore,
  });

  const suggestedEquityRange = ALLOCATION_ANCHOR_DATA[riskTolerance][timeline];
  const anchorEquityPercentage = deriveAnchorEquityPercentage(
    suggestedEquityRange,
    riskSelfRatingScore,
  );
  const ctx: AllocationProposalContext = { amount, timeline, suggestedEquityRange };

  logger.info("Derived allocation anchor", {
    suggestedEquityRange,
    anchorEquityPercentage,
  });

  const result = parseResult(
    await runConversation({
      initHandler: createInitHandler(amount, anchorEquityPercentage),
      turnHandler: createTurnHandler(ctx, anchorEquityPercentage),
      responder,
    }),
  );

  logger.info("Completed allocation phase", { result });

  return result;
};
