import { createLogger } from "#lib/logger";
import {
  askWithClassify,
  isClassifyError,
  mapClassifyError,
} from "#pipeline/ask-with-classify";
import {
  AMOUNT_CLASSIFY_INSTRUCTIONS,
  AMOUNT_QUESTION,
} from "#pipeline/stages/clarify/amount/clarify.amount.prompts";
import {
  AmountClassifyResolvedSchema,
  AmountClassifySchema,
} from "#pipeline/stages/clarify/amount/clarify.amount.schemas";
import type { AmountPhaseResult } from "#pipeline/stages/clarify/amount/clarify.amount.types";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyAmount");

export const collectAmount = async (responder: Responder): Promise<AmountPhaseResult> => {
  logger.info("Starting amount phase");

  try {
    const output = await askWithClassify({
      question: AMOUNT_QUESTION,
      classifyInstructions: AMOUNT_CLASSIFY_INSTRUCTIONS,
      schema: AmountClassifySchema,
      resolvedSchema: AmountClassifyResolvedSchema,
      responder,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 1,
    });

    const result = {
      status: PipelineStatusEnum.enum.completed,
      amount: output.amount,
    } as const;

    logger.debug("Amount output", { output: result });

    return result;
  } catch (error) {
    if (isClassifyError(error)) {
      return mapClassifyError(
        error,
        "collectAmount",
        ClarifyUnresolvedReasonEnum.enum.amount,
      );
    }

    throw error;
  }
};
