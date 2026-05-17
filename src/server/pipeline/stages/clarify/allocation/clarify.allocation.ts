import { createLogger } from "#lib/logger";
import {
  type AllocationCell,
  ALLOCATION_ANCHOR_DATA,
  MAX_ALLOCATION_TOOL_CALLS,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import {
  ALLOCATION_EXTRACTION_INSTRUCTIONS,
  ALLOCATION_PROMPT,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.prompts";
import { AllocationPhaseOutputSchema } from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type {
  AllocationPhaseInput,
  AllocationPhaseOutput,
  AllocationPhaseResult,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import type { SelfRatingScore } from "#pipeline/stages/clarify/risk/clarify.risk.types";
import {
  isPhaseLoopExhaustedError,
  runPhaseExtraction,
  runPhaseLoop,
} from "#pipeline/stages/clarify/shared/clarify.phase";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyAllocation");

// +2/-2 insets keep proposals off the cell boundary; score 3 hits the midpoint
// because it's the only score in the moderate bucket.
export const pickEquityPercentage = (
  cell: AllocationCell,
  score: SelfRatingScore,
): number => {
  switch (score) {
    case 1:
    case 4:
      return cell.min + 2;
    case 2:
    case 5:
      return cell.max - 2;
    case 3:
      return (cell.min + cell.max) / 2;
    default:
      // SelfRatingScore is inferred as number — Zod validates 1–5 at runtime only.
      throw new Error(`pickEquityPercentage: invalid selfRatingScore ${score}`);
  }
};

const formatShekels = (n: number): string => `₪${n.toLocaleString("en-US")}`;

export const collectAllocation = async (
  { amount, timeline, riskTolerance, selfRatingScore }: AllocationPhaseInput,
  responder: Responder,
): Promise<AllocationPhaseResult> => {
  logger.info("Starting allocation phase", {
    amount,
    timeline,
    riskTolerance,
    selfRatingScore,
  });

  const cell = ALLOCATION_ANCHOR_DATA[riskTolerance][timeline];
  const equityPercentage = pickEquityPercentage(cell, selfRatingScore);
  const bufferPercentage = 100 - equityPercentage;
  const equityShekels = (amount * equityPercentage) / 100;
  const bufferShekels = amount - equityShekels;

  const context = [
    `Investment amount: ${formatShekels(amount)}`,
    `Investment timeline: ${timeline}`,
    `Recommended range: ${cell.min}–${cell.max}% equity`,
    `Proposed split: ${formatShekels(equityShekels)} in stock ETFs, ${formatShekels(bufferShekels)} in a buffer (${equityPercentage}% / ${bufferPercentage}%)`,
  ].join("\n");

  let responseId: string;
  try {
    ({ responseId } = await runPhaseLoop({
      model: "gpt-5.4-nano",
      effort: "low",
      instructions: ALLOCATION_PROMPT,
      input: context,
      maxToolCalls: MAX_ALLOCATION_TOOL_CALLS,
      phaseName: "Allocation phase",
      responder,
    }));
  } catch (error) {
    if (isPhaseLoopExhaustedError(error)) {
      logger.info("Allocation phase unresolved — tool calls exhausted");

      return {
        status: PipelineStatusEnum.enum.unresolved,
        reason: ClarifyUnresolvedReasonEnum.enum.allocation,
      };
    }

    throw error;
  }

  const { id, usage, output } = await runPhaseExtraction<AllocationPhaseOutput>({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions: ALLOCATION_EXTRACTION_INSTRUCTIONS,
    lastResponseId: responseId,
    schema: AllocationPhaseOutputSchema,
  });

  logger.info("Allocation extraction complete", { responseId: id, usage });
  logger.debug("Allocation output", { output });

  return { status: PipelineStatusEnum.enum.completed, ...output };
};
