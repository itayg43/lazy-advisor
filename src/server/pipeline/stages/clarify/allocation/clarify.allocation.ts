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
  AllocationClassifierOutput,
  AllocationPhaseInput,
  AllocationPhaseResult,
  CounterBranch,
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

type ProposalContext = {
  amount: number;
  timeline: string;
  suggestedEquityRange: AllocationSuggestedEquityRange;
};

const composeCounterReply = async (
  branch: CounterBranch,
  proposedEquityPercentage: number,
  previousEquityPercentage: number,
  ctx: ProposalContext,
): Promise<string> => {
  const proposedBufferPercentage = 100 - proposedEquityPercentage;
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
  const bufferPercentage = 100 - currentEquityPercentage;
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

export const collectAllocation = async (
  { amount, timeline, riskTolerance, riskSelfRatingScore }: AllocationPhaseInput,
  responder: Responder,
): Promise<AllocationPhaseResult> => {
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

  const conversationState = {
    currentEquityPercentage: anchorEquityPercentage,
    extremeFramingShown: false,
    compoundImpactFramingShown: false,
    turnsTaken: 0,
  };

  const initHandler: InitHandler<AllocationPhaseResult> = async () => ({
    kind: DirectiveKind.Ask,
    message: buildInitialProposal(
      amount,
      anchorEquityPercentage,
      100 - anchorEquityPercentage,
    ),
  });

  const turnHandler: TurnHandler<AllocationPhaseResult> = async (
    history,
    lastUserResponse,
  ) => {
    conversationState.turnsTaken++;

    const intent = await classifyTurn(history);

    if (
      intent.kind === AllocationIntentKindEnum.enum.accept ||
      intent.kind === AllocationIntentKindEnum.enum["accept-original"]
    ) {
      const finalEquityPercentage =
        intent.kind === AllocationIntentKindEnum.enum["accept-original"]
          ? anchorEquityPercentage
          : conversationState.currentEquityPercentage;

      return {
        kind: DirectiveKind.Done,
        result: {
          status: PipelineStatusEnum.enum.completed,
          equityPercentage: finalEquityPercentage,
          bufferPercentage: 100 - finalEquityPercentage,
        },
      };
    }

    if (conversationState.turnsTaken >= MAX_NEGOTIATION_TURNS) {
      logger.warn("Allocation phase unresolved — turn budget exhausted");

      return {
        kind: DirectiveKind.Done,
        result: {
          status: PipelineStatusEnum.enum.unresolved,
          reason: ClarifyUnresolvedReasonEnum.enum.allocation,
        },
      };
    }

    if (intent.kind === AllocationIntentKindEnum.enum.counter) {
      if (intent.proposedEquityPercentage === null) {
        logger.warn(
          "Counter intent without proposedEquityPercentage — treating as unknown",
        );

        return {
          kind: DirectiveKind.Ask,
          message:
            "I didn't catch a specific percentage. Could you tell me what split you'd like, or reply 'yes' to accept the current one?",
        };
      }

      const previousEquityPercentage = conversationState.currentEquityPercentage;
      conversationState.currentEquityPercentage = intent.proposedEquityPercentage;

      const branch = selectCounterBranch(
        intent.proposedEquityPercentage,
        suggestedEquityRange,
        conversationState.extremeFramingShown,
        conversationState.compoundImpactFramingShown,
      );
      if (branch.kind === AllocationCounterBranchKindEnum.enum.extreme) {
        conversationState.extremeFramingShown = true;
      }
      if (branch.kind === AllocationCounterBranchKindEnum.enum["compound-impact"]) {
        conversationState.compoundImpactFramingShown = true;
      }

      const reply = await composeCounterReply(
        branch,
        intent.proposedEquityPercentage,
        previousEquityPercentage,
        ctx,
      );

      return { kind: DirectiveKind.Ask, message: reply };
    }

    if (intent.kind === AllocationIntentKindEnum.enum.question) {
      const reply = await composeQuestionReply(
        lastUserResponse,
        conversationState.currentEquityPercentage,
        ctx,
      );

      return { kind: DirectiveKind.Ask, message: reply };
    }

    return {
      kind: DirectiveKind.Ask,
      message:
        "I didn't catch that. Want the proposed split, more in stocks, or more in buffer?",
    };
  };

  return runConversation({ initHandler, turnHandler, responder });
};
