import { zodTextFormat } from "openai/helpers/zod";
import type { EasyInputMessage } from "openai/resources/responses/responses";

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
  calculateBufferPercentage,
  computeSplit,
  formatCurrency,
  isAcceptKind,
  pickEquityPercentage,
  selectCounterBranch,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.lib";
import {
  ALLOCATION_CLASSIFIER_PROMPT,
  ALLOCATION_COUNTER_COMPOSER_PROMPT,
  ALLOCATION_QUESTION_COMPOSER_PROMPT,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.prompts";
import {
  AllocationClassifierOutputSchema,
  AllocationComposerOutputSchema,
  AllocationCounterBranchKindEnum,
  AllocationIntentKindEnum,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type {
  AllocationAcceptIntentKind,
  AllocationClassifierOutput,
  AllocationCounterBranch,
  AllocationHandlerAskOutput,
  AllocationHandlerDoneOutput,
  AllocationNegotiationState,
  AllocationPhaseInput,
  AllocationPhaseResult,
  AllocationProposalContext,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";
import { callOpenAIParsed } from "#services/openai";

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

const classifyTurn = async (
  history: ReadonlyArray<EasyInputMessage>,
): Promise<AllocationClassifierOutput> => {
  const { id, output } = await callOpenAIParsed(
    {
      model: "gpt-5.4-nano",
      instructions: ALLOCATION_CLASSIFIER_PROMPT,
      // Spread to strip readonly — SDK's input field expects a mutable array.
      input: [...history],
      text: {
        format: zodTextFormat(
          AllocationClassifierOutputSchema,
          "AllocationClassifierOutput",
        ),
      },
      reasoning: { effort: "low" },
    },
    AllocationClassifierOutputSchema,
  );

  logger.info("Classified turn", {
    responseId: id,
    kind: output.kind,
    proposedEquityPercentage: output.proposedEquityPercentage,
  });

  return output;
};

const composeReply = async (
  instructions: string,
  input: string,
  formatName: string,
): Promise<string> => {
  const {
    output: { reply },
  } = await callOpenAIParsed(
    {
      model: "gpt-5.4-nano",
      instructions,
      input,
      text: {
        format: zodTextFormat(AllocationComposerOutputSchema, formatName),
      },
      reasoning: { effort: "low" },
    },
    AllocationComposerOutputSchema,
  );

  return reply;
};

const composeCounterReply = async (
  branch: AllocationCounterBranch,
  proposedEquityPercentage: number,
  previousEquityPercentage: number,
  ctx: AllocationProposalContext,
): Promise<string> => {
  const proposedBufferPercentage = calculateBufferPercentage(proposedEquityPercentage);
  const { equityAmount, bufferAmount } = computeSplit(
    ctx.amount,
    proposedEquityPercentage,
  );

  const branchTag =
    branch.kind === AllocationCounterBranchKindEnum.enum.extreme
      ? `extreme-${branch.direction}`
      : branch.kind;

  const input = `Branch to render: ${branchTag}
User's exact equity proposal: ${proposedEquityPercentage}% (buffer ${proposedBufferPercentage}%)
Previous equity in conversation: ${previousEquityPercentage}%
Investment amount: ${formatCurrency(ctx.amount)}
New split in shekels: ${formatCurrency(equityAmount)} in stock ETFs, ${formatCurrency(bufferAmount)} in buffer
Investment timeline: ${ctx.timeline}
Recommended range: ${ctx.suggestedEquityRange.min}–${ctx.suggestedEquityRange.max}% equity`;

  const reply = await composeReply(
    ALLOCATION_COUNTER_COMPOSER_PROMPT,
    input,
    "AllocationCounterReply",
  );

  logger.info("Composed counter reply", { reply });

  return reply;
};

const composeQuestionReply = async (
  question: string,
  currentEquityPercentage: number,
  ctx: AllocationProposalContext,
): Promise<string> => {
  const bufferPercentage = calculateBufferPercentage(currentEquityPercentage);
  const { equityAmount, bufferAmount } = computeSplit(
    ctx.amount,
    currentEquityPercentage,
  );

  const input = `Current proposal: ${formatCurrency(equityAmount)} in stock ETFs, ${formatCurrency(bufferAmount)} in buffer (${currentEquityPercentage}/${bufferPercentage})
Investment amount: ${formatCurrency(ctx.amount)}
Investment timeline: ${ctx.timeline}
Recommended range: ${ctx.suggestedEquityRange.min}–${ctx.suggestedEquityRange.max}% equity
User's question: ${question}`;

  const reply = await composeReply(
    ALLOCATION_QUESTION_COMPOSER_PROMPT,
    input,
    "AllocationQuestionReply",
  );

  logger.info("Composed question reply", { reply });

  return reply;
};

const toBudgetExhaustedDone = (): AllocationHandlerDoneOutput => {
  logger.warn("Allocation phase unresolved — turn budget exhausted");

  return {
    kind: HandlerOutputKind.Done,
    result: {
      status: PipelineStatusEnum.enum.unresolved,
      reason: ClarifyUnresolvedReasonEnum.enum.allocation,
    },
  };
};

const toMissingCounterAsk = (
  state: Readonly<AllocationNegotiationState>,
): AllocationHandlerAskOutput => {
  logger.warn("Counter intent without proposedEquityPercentage — treating as unknown");

  return {
    kind: HandlerOutputKind.Ask,
    state,
    message: ALLOCATION_MISSING_COUNTER_MESSAGE,
  };
};

const toUnknownAsk = (
  state: Readonly<AllocationNegotiationState>,
): AllocationHandlerAskOutput => {
  logger.warn("Unknown allocation intent — re-asking with generic prompt");

  return {
    kind: HandlerOutputKind.Ask,
    state,
    message: ALLOCATION_UNKNOWN_INTENT_MESSAGE,
  };
};

const handleAcceptTurn = (
  intentKind: AllocationAcceptIntentKind,
  currentEquityPercentage: number,
  anchorEquityPercentage: number,
): AllocationHandlerDoneOutput => {
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
): Promise<AllocationHandlerAskOutput> => {
  if (proposedEquityPercentage === null) return toMissingCounterAsk(state);

  const previousEquityPercentage = state.currentEquityPercentage;

  const branch = selectCounterBranch(
    proposedEquityPercentage,
    ctx.suggestedEquityRange,
    state.hasShownExtremeFraming,
    state.hasShownCompoundImpactFraming,
  );

  logger.info("Selected counter branch", {
    branch,
    previousEquityPercentage,
    proposedEquityPercentage,
  });

  const nextState: AllocationNegotiationState = {
    ...state,
    currentEquityPercentage: proposedEquityPercentage,
    hasShownExtremeFraming:
      state.hasShownExtremeFraming ||
      branch.kind === AllocationCounterBranchKindEnum.enum.extreme,
    hasShownCompoundImpactFraming:
      state.hasShownCompoundImpactFraming ||
      branch.kind === AllocationCounterBranchKindEnum.enum["compound-impact"],
  };

  const reply = await composeCounterReply(
    branch,
    proposedEquityPercentage,
    previousEquityPercentage,
    ctx,
  );

  return { kind: HandlerOutputKind.Ask, state: nextState, message: reply };
};

const handleQuestionTurn = async (
  lastUserResponse: string,
  state: Readonly<AllocationNegotiationState>,
  ctx: AllocationProposalContext,
): Promise<AllocationHandlerAskOutput> => {
  const reply = await composeQuestionReply(
    lastUserResponse,
    state.currentEquityPercentage,
    ctx,
  );

  return { kind: HandlerOutputKind.Ask, state, message: reply };
};

const createInitHandler =
  (
    amount: number,
    anchorEquityPercentage: number,
  ): InitHandler<AllocationNegotiationState, AllocationPhaseResult> =>
  async () => ({
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

const createTurnHandler =
  (
    ctx: AllocationProposalContext,
    anchorEquityPercentage: number,
  ): TurnHandler<AllocationNegotiationState, AllocationPhaseResult> =>
  async (state, history, lastUserResponse) => {
    const nextState: AllocationNegotiationState = {
      ...state,
      turnsTaken: state.turnsTaken + 1,
    };

    const intent = await classifyTurn(history);
    const { kind } = intent;

    if (isAcceptKind(kind))
      return handleAcceptTurn(
        kind,
        nextState.currentEquityPercentage,
        anchorEquityPercentage,
      );

    if (nextState.turnsTaken >= MAX_NEGOTIATION_TURNS) return toBudgetExhaustedDone();

    if (kind === AllocationIntentKindEnum.enum.counter)
      return handleCounterTurn(intent.proposedEquityPercentage, nextState, ctx);
    if (kind === AllocationIntentKindEnum.enum.question)
      return handleQuestionTurn(lastUserResponse, nextState, ctx);

    return toUnknownAsk(nextState);
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
  const anchorEquityPercentage = pickEquityPercentage(
    suggestedEquityRange,
    riskSelfRatingScore,
  );
  const ctx: AllocationProposalContext = { amount, timeline, suggestedEquityRange };

  logger.info("Derived allocation anchor", {
    suggestedEquityRange,
    anchorEquityPercentage,
  });

  const result = await runConversation({
    initHandler: createInitHandler(amount, anchorEquityPercentage),
    turnHandler: createTurnHandler(ctx, anchorEquityPercentage),
    responder,
  });

  logger.info("Completed allocation phase", { result });

  return result;
};
