import { zodTextFormat } from "openai/helpers/zod";
import type { EasyInputMessage } from "openai/resources/responses/responses";

import { createLogger } from "#lib/logger";
import {
  DirectiveKind,
  runConversation,
  type InitHandler,
  type TurnHandler,
} from "#pipeline/run-conversation";
import {
  ALLOCATION_ANCHOR_DATA,
  MAX_NEGOTIATION_TURNS,
  type AllocationSuggestedEquityRange,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import {
  calculateBufferPercentage,
  computeSplit,
  formatCurrency,
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
  AllocationTurnAskOutput,
  AllocationClassifierOutput,
  AllocationTurnDoneOutput,
  AllocationPhaseInput,
  AllocationPhaseResult,
  AllocationConversationState,
  AllocationCounterBranch,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("clarifyAllocation");

type ProposalContext = {
  amount: number;
  timeline: string;
  suggestedEquityRange: AllocationSuggestedEquityRange;
};

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

const composeCounterReply = async (
  branch: AllocationCounterBranch,
  proposedEquityPercentage: number,
  previousEquityPercentage: number,
  ctx: ProposalContext,
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

  const {
    output: { reply },
  } = await callOpenAIParsed(
    {
      model: "gpt-5.4-nano",
      instructions: ALLOCATION_COUNTER_COMPOSER_PROMPT,
      input,
      text: {
        format: zodTextFormat(AllocationComposerOutputSchema, "AllocationCounterReply"),
      },
      reasoning: { effort: "low" },
    },
    AllocationComposerOutputSchema,
  );

  logger.info("Composed counter reply", { reply });

  return reply;
};

const composeQuestionReply = async (
  question: string,
  currentEquityPercentage: number,
  ctx: ProposalContext,
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

  const {
    output: { reply },
  } = await callOpenAIParsed(
    {
      model: "gpt-5.4-nano",
      instructions: ALLOCATION_QUESTION_COMPOSER_PROMPT,
      input,
      text: {
        format: zodTextFormat(AllocationComposerOutputSchema, "AllocationQuestionReply"),
      },
      reasoning: { effort: "low" },
    },
    AllocationComposerOutputSchema,
  );

  logger.info("Composed question reply", { reply });

  return reply;
};

const toBudgetExhaustedDone = (): AllocationTurnDoneOutput => {
  logger.warn("Allocation phase unresolved — turn budget exhausted");

  return {
    kind: DirectiveKind.Done,
    result: {
      status: PipelineStatusEnum.enum.unresolved,
      reason: ClarifyUnresolvedReasonEnum.enum.allocation,
    },
  };
};

const toMissingCounterAsk = (
  state: Readonly<AllocationConversationState>,
): AllocationTurnAskOutput => {
  logger.warn("Counter intent without proposedEquityPercentage — treating as unknown");

  return {
    kind: DirectiveKind.Ask,
    state,
    message:
      "I didn't catch a specific percentage. Could you tell me what split you'd like, or reply 'yes' to accept the current one?",
  };
};

const toUnknownAsk = (
  state: Readonly<AllocationConversationState>,
): AllocationTurnAskOutput => {
  logger.warn("Unknown allocation intent — re-asking with generic prompt");

  return {
    kind: DirectiveKind.Ask,
    state,
    message:
      "I didn't catch that. Want the proposed split, more in stocks, or more in buffer?",
  };
};

const handleAcceptTurn = (
  intentKind: AllocationAcceptIntentKind,
  state: Readonly<AllocationConversationState>,
  anchorEquityPercentage: number,
): AllocationTurnDoneOutput => {
  const finalEquityPercentage =
    intentKind === AllocationIntentKindEnum.enum["accept-original"]
      ? anchorEquityPercentage
      : state.currentEquityPercentage;

  return {
    kind: DirectiveKind.Done,
    result: {
      status: PipelineStatusEnum.enum.completed,
      equityPercentage: finalEquityPercentage,
      bufferPercentage: calculateBufferPercentage(finalEquityPercentage),
    },
  };
};

const handleCounterTurn = async (
  proposedEquityPercentage: number | null,
  state: Readonly<AllocationConversationState>,
  ctx: ProposalContext,
): Promise<AllocationTurnAskOutput> => {
  if (proposedEquityPercentage === null) return toMissingCounterAsk(state);

  const previousEquityPercentage = state.currentEquityPercentage;

  const branch = selectCounterBranch(
    proposedEquityPercentage,
    ctx.suggestedEquityRange,
    state.extremeFramingShown,
    state.compoundImpactFramingShown,
  );

  const nextState: AllocationConversationState = {
    ...state,
    currentEquityPercentage: proposedEquityPercentage,
    extremeFramingShown:
      state.extremeFramingShown ||
      branch.kind === AllocationCounterBranchKindEnum.enum.extreme,
    compoundImpactFramingShown:
      state.compoundImpactFramingShown ||
      branch.kind === AllocationCounterBranchKindEnum.enum["compound-impact"],
  };

  const reply = await composeCounterReply(
    branch,
    proposedEquityPercentage,
    previousEquityPercentage,
    ctx,
  );

  return { kind: DirectiveKind.Ask, state: nextState, message: reply };
};

const handleQuestionTurn = async (
  lastUserResponse: string,
  state: Readonly<AllocationConversationState>,
  ctx: ProposalContext,
): Promise<AllocationTurnAskOutput> => {
  const reply = await composeQuestionReply(
    lastUserResponse,
    state.currentEquityPercentage,
    ctx,
  );

  return { kind: DirectiveKind.Ask, state, message: reply };
};

const createTurnHandler =
  (
    ctx: ProposalContext,
    anchorEquityPercentage: number,
  ): TurnHandler<AllocationConversationState, AllocationPhaseResult> =>
  async (state, history, lastUserResponse) => {
    const nextState: AllocationConversationState = {
      ...state,
      turnsTaken: state.turnsTaken + 1,
    };

    const intent = await classifyTurn(history);
    const { kind } = intent;

    if (
      kind === AllocationIntentKindEnum.enum.accept ||
      kind === AllocationIntentKindEnum.enum["accept-original"]
    )
      return handleAcceptTurn(kind, nextState, anchorEquityPercentage);

    if (nextState.turnsTaken >= MAX_NEGOTIATION_TURNS) return toBudgetExhaustedDone();

    if (intent.kind === AllocationIntentKindEnum.enum.counter)
      return handleCounterTurn(intent.proposedEquityPercentage, nextState, ctx);
    if (intent.kind === AllocationIntentKindEnum.enum.question)
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
  const ctx: ProposalContext = { amount, timeline, suggestedEquityRange };

  const initHandler: InitHandler<
    AllocationConversationState,
    AllocationPhaseResult
  > = async (): Promise<AllocationTurnAskOutput> => ({
    kind: DirectiveKind.Ask,
    state: {
      currentEquityPercentage: anchorEquityPercentage,
      extremeFramingShown: false,
      compoundImpactFramingShown: false,
      turnsTaken: 0,
    },
    message: buildInitialProposal(
      amount,
      anchorEquityPercentage,
      calculateBufferPercentage(anchorEquityPercentage),
    ),
  });

  const turnHandler = createTurnHandler(ctx, anchorEquityPercentage);

  return runConversation({ initHandler, turnHandler, responder });
};
