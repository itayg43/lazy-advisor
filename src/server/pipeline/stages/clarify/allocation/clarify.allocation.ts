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
  type AllocationCell,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import {
  ALLOCATION_CLASSIFIER_PROMPT,
  ALLOCATION_COUNTER_COMPOSER_PROMPT,
  ALLOCATION_QUESTION_COMPOSER_PROMPT,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.prompts";
import {
  AllocationClassifierOutputSchema,
  AllocationComposerOutputSchema,
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

const MODEL = "gpt-5.4-nano";
const EFFORT = "low";
// Per-conversation soft cap. The primitive enforces no budget — convergence is
// the handler's job. Counts user replies; on the MAX_TURNSth turn the handler
// returns `Done` with `unresolved` regardless of intent. Original phase used a
// 5-tool-call budget; same magnitude, different unit.
const MAX_TURNS = 5;

const EXTREME_THRESHOLD_PP = 40;

// Pairing is bucket-relative position (see mapScoreToBucket in clarify.risk.ts):
// (1, 4) = cautious end of their bucket; (2, 5) = comfortable end; 3 = midpoint
// (moderate is a single-score bucket). Landing on cell edges keeps proposals
// round (80/20, 90/10) instead of awkward insets (82/18, 88/12).
export const pickEquityPercentage = (
  cell: AllocationCell,
  score: RiskSelfRatingScore,
): number => {
  switch (score) {
    case 1:
    case 4:
      return cell.min;
    case 2:
    case 5:
      return cell.max;
    case 3:
      return (cell.min + cell.max) / 2;
  }
};

const formatShekels = (n: number): string => `₪${n.toLocaleString("en-US")}`;

const ppOutsideRange = (proposedEquity: number, cell: AllocationCell): number => {
  if (proposedEquity > cell.max) return proposedEquity - cell.max;
  if (proposedEquity < cell.min) return cell.min - proposedEquity;

  return 0;
};

const selectCounterBranch = (
  proposedEquity: number,
  cell: AllocationCell,
  hasShownExtreme: boolean,
  hasShownCompoundImpact: boolean,
): CounterBranch => {
  const distance = ppOutsideRange(proposedEquity, cell);
  if (distance >= EXTREME_THRESHOLD_PP && !hasShownExtreme) {
    return {
      kind: "extreme",
      direction: proposedEquity > cell.max ? "too-high" : "too-low",
    };
  }
  if (!hasShownCompoundImpact) return { kind: "compound-impact" };

  return { kind: "bare" };
};

const buildInitialProposal = (
  amount: number,
  equityPercentage: number,
  bufferPercentage: number,
): string => {
  const equityShekels = (amount * equityPercentage) / 100;
  const bufferShekels = amount - equityShekels;

  // Templated to lock in the Rule 1 contract: shekels + percent, relative
  // trade-off (no specific drawdown %), and the "tends to reduce" framing.
  return [
    `Based on your timeline and comfort with drops, I'd propose ${formatShekels(equityShekels)} in stock ETFs and ${formatShekels(bufferShekels)} in a buffer — roughly ${equityPercentage}/${bufferPercentage}.`,
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
      model: MODEL,
      instructions: ALLOCATION_CLASSIFIER_PROMPT,
      input: [...history],
      text: {
        format: zodTextFormat(
          AllocationClassifierOutputSchema,
          "AllocationClassifierOutput",
        ),
      },
      reasoning: { effort: EFFORT },
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
  cell: AllocationCell;
};

const composeCounterReply = async (
  branch: CounterBranch,
  proposedEquity: number,
  ctx: ProposalContext,
): Promise<string> => {
  const proposedBuffer = 100 - proposedEquity;
  const equityShekels = (ctx.amount * proposedEquity) / 100;
  const bufferShekels = ctx.amount - equityShekels;

  const branchTag =
    branch.kind === "extreme"
      ? branch.direction === "too-high"
        ? "extreme-too-high"
        : "extreme-too-low"
      : branch.kind;

  const input = [
    `Branch to render: ${branchTag}`,
    `User's exact equity proposal: ${proposedEquity}% (buffer ${proposedBuffer}%)`,
    `Investment amount: ${formatShekels(ctx.amount)}`,
    `New split in shekels: ${formatShekels(equityShekels)} in stock ETFs, ${formatShekels(bufferShekels)} in buffer`,
    `Investment timeline: ${ctx.timeline}`,
    `Recommended range: ${ctx.cell.min}–${ctx.cell.max}% equity`,
  ].join("\n");

  const {
    output: { reply },
  } = await callOpenAIParsed(
    {
      model: MODEL,
      instructions: ALLOCATION_COUNTER_COMPOSER_PROMPT,
      input,
      text: {
        format: zodTextFormat(AllocationComposerOutputSchema, "AllocationCounterReply"),
      },
      reasoning: { effort: EFFORT },
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
  const equityShekels = (ctx.amount * currentEquity) / 100;
  const bufferShekels = ctx.amount - equityShekels;

  const input = [
    `Current proposal: ${formatShekels(equityShekels)} in stock ETFs, ${formatShekels(bufferShekels)} in buffer (${currentEquity}/${bufferPercentage})`,
    `Investment amount: ${formatShekels(ctx.amount)}`,
    `Investment timeline: ${ctx.timeline}`,
    `Recommended range: ${ctx.cell.min}–${ctx.cell.max}% equity`,
    `User's question: ${question}`,
  ].join("\n");

  const {
    output: { reply },
  } = await callOpenAIParsed(
    {
      model: MODEL,
      instructions: ALLOCATION_QUESTION_COMPOSER_PROMPT,
      input,
      text: {
        format: zodTextFormat(AllocationComposerOutputSchema, "AllocationQuestionReply"),
      },
      reasoning: { effort: EFFORT },
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

  const cell = ALLOCATION_ANCHOR_DATA[riskTolerance][timeline];
  const anchorEquity = pickEquityPercentage(cell, riskSelfRatingScore);
  const ctx: ProposalContext = { amount, timeline, cell };

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

    if (intent.kind === "accept") {
      return {
        kind: DirectiveKind.Done,
        result: {
          status: PipelineStatusEnum.enum.completed,
          equityPercentage: conversationState.currentEquity,
          bufferPercentage: 100 - conversationState.currentEquity,
        },
      };
    }

    if (conversationState.turnsTaken >= MAX_TURNS) {
      logger.warn("Allocation phase unresolved — turn budget exhausted");

      return {
        kind: DirectiveKind.Done,
        result: {
          status: PipelineStatusEnum.enum.unresolved,
          reason: ClarifyUnresolvedReasonEnum.enum.allocation,
        },
      };
    }

    if (intent.kind === "counter") {
      if (intent.proposedEquity === null) {
        logger.warn("Counter intent without proposedEquity — treating as unknown");

        return {
          kind: DirectiveKind.Ask,
          message:
            "I didn't catch a specific percentage. Could you tell me what split you'd like, or reply 'yes' to accept the current one?",
        };
      }

      conversationState.currentEquity = intent.proposedEquity;

      const branch = selectCounterBranch(
        intent.proposedEquity,
        cell,
        conversationState.extremeFramingShown,
        conversationState.compoundImpactFramingShown,
      );
      if (branch.kind === "extreme") conversationState.extremeFramingShown = true;
      if (branch.kind === "compound-impact")
        conversationState.compoundImpactFramingShown = true;

      const reply = await composeCounterReply(branch, intent.proposedEquity, ctx);

      return { kind: DirectiveKind.Ask, message: reply };
    }

    if (intent.kind === "question") {
      const reply = await composeQuestionReply(
        lastUserResponse,
        conversationState.currentEquity,
        ctx,
      );

      return { kind: DirectiveKind.Ask, message: reply };
    }

    // unknown — re-prompt without mutating state.
    return {
      kind: DirectiveKind.Ask,
      message:
        "I didn't catch that. Want the proposed split, more in stocks, or more in buffer?",
    };
  };

  return runConversation({ initHandler, turnHandler, responder });
};
