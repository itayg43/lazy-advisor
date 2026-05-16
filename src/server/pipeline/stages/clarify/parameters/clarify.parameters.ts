import { createLogger } from "#lib/logger";
import {
  askWithClassify,
  isClassifyError,
  mapClassifyError,
} from "#pipeline/ask-with-classify";
import {
  AMOUNT_CLASSIFY_INSTRUCTIONS,
  AMOUNT_QUESTION,
  TIMELINE_CLASSIFY_INSTRUCTIONS,
  TIMELINE_QUESTION,
} from "#pipeline/stages/clarify/parameters/clarify.parameters.prompts";
import {
  AmountClassifyResolvedSchema,
  AmountClassifySchema,
  TimelineClassifyResolvedSchema,
  TimelineClassifySchema,
} from "#pipeline/stages/clarify/parameters/clarify.parameters.schemas";
import type {
  AskAmountResult,
  AskTimelineResult,
  ParametersPhaseResult,
} from "#pipeline/stages/clarify/parameters/clarify.parameters.types";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyParameters");

const askAmount = async (responder: Responder): Promise<AskAmountResult> => {
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

    logger.debug("askAmount output", { output: result });

    return result;
  } catch (error) {
    if (isClassifyError(error))
      return mapClassifyError(
        error,
        "askAmount",
        ClarifyUnresolvedReasonEnum.enum.amount,
      );

    throw error;
  }
};

const askTimeline = async (responder: Responder): Promise<AskTimelineResult> => {
  try {
    const output = await askWithClassify({
      question: TIMELINE_QUESTION,
      classifyInstructions: TIMELINE_CLASSIFY_INSTRUCTIONS,
      schema: TimelineClassifySchema,
      resolvedSchema: TimelineClassifyResolvedSchema,
      responder,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 1,
    });

    const result = {
      status: PipelineStatusEnum.enum.completed,
      timeline: output.timeline,
    } as const;

    logger.debug("askTimeline output", { output: result });

    return result;
  } catch (error) {
    if (isClassifyError(error))
      return mapClassifyError(
        error,
        "askTimeline",
        ClarifyUnresolvedReasonEnum.enum.timeline,
      );

    throw error;
  }
};

export const collectParameters = async (
  responder: Responder,
): Promise<ParametersPhaseResult> => {
  logger.info("Starting parameters phase");

  const amountResult = await askAmount(responder);
  if (amountResult.status !== PipelineStatusEnum.enum.completed) return amountResult;

  const timelineResult = await askTimeline(responder);
  if (timelineResult.status !== PipelineStatusEnum.enum.completed) return timelineResult;

  const result = {
    status: PipelineStatusEnum.enum.completed,
    amount: amountResult.amount,
    timeline: timelineResult.timeline,
  } as const;

  logger.debug("Parameters output", { output: result });

  return result;
};
