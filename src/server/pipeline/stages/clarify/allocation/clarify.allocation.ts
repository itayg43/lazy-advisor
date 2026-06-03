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
  AllocationPhaseOutput,
  AllocationPhaseResult,
  AllocationProposalContext,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyAllocation");

const buildInitialProposal = (amount: number, equityPercentage: number): string => {
  const { equityAmount, bufferAmount } = computeSplit(amount, equityPercentage);
  const bufferPercentage = calculateBufferPercentage(equityPercentage);

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

// Inner fail-fast: re-validates the equity/buffer pair at its construction site,
// so a bug in the accept path surfaces here instead of flowing out. `unknown`
// keeps it a genuine boundary check. No logging here — the `runClarify` catch
// logs `BaseError`s once. Overlaps `parseResult` on purpose: defense-in-depth.
const parseOutput = (output: unknown): AllocationPhaseOutput => {
  const parsed = AllocationPhaseOutputSchema.safeParse(output);
  if (!parsed.success) {
    throw new InternalSchemaValidationError(
      "Allocation phase produced an output that failed schema validation",
      parsed.error,
    );
  }

  return parsed.data;
};

const handleAcceptTurn = (
  intentKind: AllocationAcceptIntentKind,
  {
    currentEquityPercentage,
    anchorEquityPercentage,
  }: { currentEquityPercentage: number; anchorEquityPercentage: number },
): AllocationHandlerOutput => {
  const finalEquityPercentage =
    intentKind === AllocationIntentKindEnum.enum["accept-original"]
      ? anchorEquityPercentage
      : currentEquityPercentage;

  const output = parseOutput({
    equityPercentage: finalEquityPercentage,
    bufferPercentage: calculateBufferPercentage(finalEquityPercentage),
  });

  logger.info("Accepted allocation", { intentKind, ...output });

  return {
    kind: HandlerOutputKind.Done,
    result: { status: PipelineStatusEnum.enum.completed, ...output },
  };
};

const handleCounterTurn = async (
  proposedEquityPercentage: number | null,
  state: Readonly<AllocationNegotiationState>,
  ctx: AllocationProposalContext,
): Promise<AllocationAskDecision> => {
  if (proposedEquityPercentage === null) return toMissingCounterAsk();

  const previousEquityPercentage = state.currentEquityPercentage;
  const currentFramingFlags: AllocationFramingFlags = {
    hasShownExtremeFraming: state.hasShownExtremeFraming,
    hasShownCompoundImpactFraming: state.hasShownCompoundImpactFraming,
  };
  const counterBranch = selectCounterBranch(
    proposedEquityPercentage,
    ctx.suggestedEquityRange,
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
    ctx,
  );

  // `nextFramingFlags` rides in the patch, which the runner commits only after
  // `reply` is sent — so a framing is never marked shown on a turn the user never
  // received. (Atomicity note in run-conversation.ts.)
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
    message: buildInitialProposal(amount, anchorEquityPercentage),
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
      return handleAcceptTurn(kind, {
        currentEquityPercentage: state.currentEquityPercentage,
        anchorEquityPercentage,
      });

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

// Outer boundary, mirroring `parseOutput`, over the whole result — it also covers
// the unresolved arm, which has no upstream fail-fast check.
const parseResult = (result: unknown): AllocationPhaseResult => {
  const parsed = AllocationPhaseResultSchema.safeParse(result);
  if (!parsed.success) {
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
