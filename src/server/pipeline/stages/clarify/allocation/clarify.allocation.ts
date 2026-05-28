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
  AllocationAskDirective,
  AllocationClassifierOutput,
  AllocationDoneDirective,
  AllocationPhaseInput,
  AllocationPhaseResult,
  CounterBranch,
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

type ConversationState = {
  currentEquityPercentage: number;
  extremeFramingShown: boolean;
  compoundImpactFramingShown: boolean;
  turnsTaken: number;
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
  branch: CounterBranch,
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

const toBudgetExhaustedDone = (): AllocationDoneDirective => {
  logger.warn("Allocation phase unresolved — turn budget exhausted");

  return {
    kind: DirectiveKind.Done,
    result: {
      status: PipelineStatusEnum.enum.unresolved,
      reason: ClarifyUnresolvedReasonEnum.enum.allocation,
    },
  };
};

const toMissingCounterAsk = (): AllocationAskDirective => {
  logger.warn("Counter intent without proposedEquityPercentage — treating as unknown");

  return {
    kind: DirectiveKind.Ask,
    message:
      "I didn't catch a specific percentage. Could you tell me what split you'd like, or reply 'yes' to accept the current one?",
  };
};

const handleAcceptTurn = (
  intentKind: AllocationAcceptIntentKind,
  state: ConversationState,
  anchorEquityPercentage: number,
): AllocationDoneDirective => {
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
  state: ConversationState,
  ctx: ProposalContext,
): Promise<AllocationAskDirective> => {
  if (proposedEquityPercentage === null) return toMissingCounterAsk();

  const previousEquityPercentage = state.currentEquityPercentage;
  state.currentEquityPercentage = proposedEquityPercentage;

  const branch = selectCounterBranch(
    proposedEquityPercentage,
    ctx.suggestedEquityRange,
    state.extremeFramingShown,
    state.compoundImpactFramingShown,
  );
  const { kind } = branch;

  if (kind === AllocationCounterBranchKindEnum.enum.extreme)
    state.extremeFramingShown = true;
  else if (kind === AllocationCounterBranchKindEnum.enum["compound-impact"])
    state.compoundImpactFramingShown = true;

  const reply = await composeCounterReply(
    branch,
    proposedEquityPercentage,
    previousEquityPercentage,
    ctx,
  );

  return { kind: DirectiveKind.Ask, message: reply };
};

const handleQuestionTurn = async (
  lastUserResponse: string,
  state: ConversationState,
  ctx: ProposalContext,
): Promise<AllocationAskDirective> => {
  const reply = await composeQuestionReply(
    lastUserResponse,
    state.currentEquityPercentage,
    ctx,
  );

  return { kind: DirectiveKind.Ask, message: reply };
};

const createTurnHandler =
  (
    state: ConversationState,
    ctx: ProposalContext,
    anchorEquityPercentage: number,
  ): TurnHandler<AllocationPhaseResult> =>
  async (history, lastUserResponse) => {
    state.turnsTaken++;

    const intent = await classifyTurn(history);
    const { kind } = intent;

    if (
      kind === AllocationIntentKindEnum.enum.accept ||
      kind === AllocationIntentKindEnum.enum["accept-original"]
    )
      return handleAcceptTurn(kind, state, anchorEquityPercentage);

    if (state.turnsTaken >= MAX_NEGOTIATION_TURNS) return toBudgetExhaustedDone();

    if (intent.kind === AllocationIntentKindEnum.enum.counter)
      return handleCounterTurn(intent.proposedEquityPercentage, state, ctx);
    if (intent.kind === AllocationIntentKindEnum.enum.question)
      return handleQuestionTurn(lastUserResponse, state, ctx);

    return {
      kind: DirectiveKind.Ask,
      message:
        "I didn't catch that. Want the proposed split, more in stocks, or more in buffer?",
    };
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

  const state: ConversationState = {
    currentEquityPercentage: anchorEquityPercentage,
    extremeFramingShown: false,
    compoundImpactFramingShown: false,
    turnsTaken: 0,
  };

  const initHandler: InitHandler<
    AllocationPhaseResult
  > = async (): Promise<AllocationAskDirective> => ({
    kind: DirectiveKind.Ask,
    message: buildInitialProposal(
      amount,
      anchorEquityPercentage,
      calculateBufferPercentage(anchorEquityPercentage),
    ),
  });

  const turnHandler = createTurnHandler(state, ctx, anchorEquityPercentage);

  return runConversation({ initHandler, turnHandler, responder });
};
