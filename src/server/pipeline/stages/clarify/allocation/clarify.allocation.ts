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
  type AllocationSuggestedEquityRange,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import {
  ALLOCATION_CLASSIFIER_PROMPT,
  ALLOCATION_COUNTER_COMPOSER_PROMPT,
  ALLOCATION_QUESTION_COMPOSER_PROMPT,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.prompts";
import {
  AllocationClassifierOutputSchema,
  AllocationComposerOutputSchema,
  AllocationCounterBranchKindEnum,
  AllocationCounterDirectionEnum,
  AllocationIntentKindEnum,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type {
  AllocationClassifierOutput,
  AllocationPhaseInput,
  AllocationPhaseResult,
  CounterBranch,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import type { RiskSelfRatingScore } from "#pipeline/stages/clarify/risk/clarify.risk.types";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("clarifyAllocation");

const MAX_NEGOTIATION_TURNS = 5;
const EXTREME_DEVIATION_PERCENTAGE_POINTS = 40;

export const pickEquityPercentage = (
  range: AllocationSuggestedEquityRange,
  score: RiskSelfRatingScore,
): number => {
  switch (score) {
    case 1:
    case 4:
      return range.min;
    case 2:
    case 5:
      return range.max;
    case 3:
      return (range.min + range.max) / 2;
  }
};

const formatShekels = (n: number): string => `₪${n.toLocaleString("en-US")}`;

const computeSplit = (
  amount: number,
  equityPercentage: number,
): { equity: number; buffer: number } => {
  const equity = (amount * equityPercentage) / 100;

  return { equity, buffer: amount - equity };
};

const equityDeviationPercentagePoints = (
  proposedEquity: number,
  suggestedEquityRange: AllocationSuggestedEquityRange,
): number =>
  Math.max(
    0,
    proposedEquity - suggestedEquityRange.max,
    suggestedEquityRange.min - proposedEquity,
  );

const selectCounterBranch = (
  proposedEquity: number,
  suggestedEquityRange: AllocationSuggestedEquityRange,
  hasShownExtreme: boolean,
  hasShownCompoundImpact: boolean,
): CounterBranch => {
  const deviation = equityDeviationPercentagePoints(proposedEquity, suggestedEquityRange);
  if (deviation >= EXTREME_DEVIATION_PERCENTAGE_POINTS && !hasShownExtreme) {
    return {
      kind: AllocationCounterBranchKindEnum.enum.extreme,
      direction:
        proposedEquity > suggestedEquityRange.max
          ? AllocationCounterDirectionEnum.enum["too-high"]
          : AllocationCounterDirectionEnum.enum["too-low"],
    };
  }
  if (!hasShownCompoundImpact) {
    return { kind: AllocationCounterBranchKindEnum.enum["compound-impact"] };
  }

  return { kind: AllocationCounterBranchKindEnum.enum.bare };
};

const buildInitialProposal = (
  amount: number,
  equityPercentage: number,
  bufferPercentage: number,
): string => {
  const { equity, buffer } = computeSplit(amount, equityPercentage);

  return [
    `Based on your timeline and comfort with drops, I'd propose ${formatShekels(equity)} in stock ETFs and ${formatShekels(buffer)} in a buffer — roughly ${equityPercentage}/${bufferPercentage}.`,
    `More in stocks means bigger drops in bad years and higher long-run growth; less in stocks means smaller drops and lower growth.`,
    `Sizing to your comfort level tends to reduce the chance of panic-selling when drops happen.`,
    `Want that split, more in stocks, or more in buffer?`,
  ].join(" ");
};

const classifyTurn = async (
  history: ReadonlyArray<EasyInputMessage>,
): Promise<AllocationClassifierOutput> => {
  const { id, output, usage } = await callOpenAIParsed(
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
    proposedEquity: output.proposedEquity,
    usage,
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
  proposedEquity: number,
  previousEquity: number,
  ctx: ProposalContext,
): Promise<string> => {
  const proposedBuffer = 100 - proposedEquity;
  const { equity, buffer } = computeSplit(ctx.amount, proposedEquity);

  const branchTag =
    branch.kind === AllocationCounterBranchKindEnum.enum.extreme
      ? `extreme-${branch.direction}`
      : branch.kind;

  const input = [
    `Branch to render: ${branchTag}`,
    `User's exact equity proposal: ${proposedEquity}% (buffer ${proposedBuffer}%)`,
    `Previous equity in conversation: ${previousEquity}%`,
    `Investment amount: ${formatShekels(ctx.amount)}`,
    `New split in shekels: ${formatShekels(equity)} in stock ETFs, ${formatShekels(buffer)} in buffer`,
    `Investment timeline: ${ctx.timeline}`,
    `Recommended range: ${ctx.suggestedEquityRange.min}–${ctx.suggestedEquityRange.max}% equity`,
  ].join("\n");

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
  currentEquity: number,
  ctx: ProposalContext,
): Promise<string> => {
  const bufferPercentage = 100 - currentEquity;
  const { equity, buffer } = computeSplit(ctx.amount, currentEquity);

  const input = [
    `Current proposal: ${formatShekels(equity)} in stock ETFs, ${formatShekels(buffer)} in buffer (${currentEquity}/${bufferPercentage})`,
    `Investment amount: ${formatShekels(ctx.amount)}`,
    `Investment timeline: ${ctx.timeline}`,
    `Recommended range: ${ctx.suggestedEquityRange.min}–${ctx.suggestedEquityRange.max}% equity`,
    `User's question: ${question}`,
  ].join("\n");

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
  const anchorEquity = pickEquityPercentage(suggestedEquityRange, riskSelfRatingScore);
  const ctx: ProposalContext = { amount, timeline, suggestedEquityRange };

  const conversationState = {
    currentEquity: anchorEquity,
    extremeFramingShown: false,
    compoundImpactFramingShown: false,
    turnsTaken: 0,
  };

  const initHandler: InitHandler<AllocationPhaseResult> = async () => ({
    kind: DirectiveKind.Ask,
    message: buildInitialProposal(amount, anchorEquity, 100 - anchorEquity),
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
      const finalEquity =
        intent.kind === AllocationIntentKindEnum.enum["accept-original"]
          ? anchorEquity
          : conversationState.currentEquity;

      return {
        kind: DirectiveKind.Done,
        result: {
          status: PipelineStatusEnum.enum.completed,
          equityPercentage: finalEquity,
          bufferPercentage: 100 - finalEquity,
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
      if (intent.proposedEquity === null) {
        logger.warn("Counter intent without proposedEquity — treating as unknown");

        return {
          kind: DirectiveKind.Ask,
          message:
            "I didn't catch a specific percentage. Could you tell me what split you'd like, or reply 'yes' to accept the current one?",
        };
      }

      const previousEquity = conversationState.currentEquity;
      conversationState.currentEquity = intent.proposedEquity;

      const branch = selectCounterBranch(
        intent.proposedEquity,
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
        intent.proposedEquity,
        previousEquity,
        ctx,
      );

      return { kind: DirectiveKind.Ask, message: reply };
    }

    if (intent.kind === AllocationIntentKindEnum.enum.question) {
      const reply = await composeQuestionReply(
        lastUserResponse,
        conversationState.currentEquity,
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
