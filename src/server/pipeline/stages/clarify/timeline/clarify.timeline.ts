import { createLogger } from "#lib/logger";
import {
  askWithClassify,
  isClassifyError,
  mapClassifyError,
} from "#pipeline/ask-with-classify";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import {
  TIMELINE_CLASSIFY_INSTRUCTIONS,
  TIMELINE_QUESTION,
} from "#pipeline/stages/clarify/timeline/clarify.timeline.prompts";
import {
  TimelineClassifyResolvedSchema,
  TimelineClassifySchema,
} from "#pipeline/stages/clarify/timeline/clarify.timeline.schemas";
import type { TimelinePhaseResult } from "#pipeline/stages/clarify/timeline/clarify.timeline.types";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyTimeline");

export const collectTimeline = async (
  responder: Responder,
): Promise<TimelinePhaseResult> => {
  logger.info("Starting timeline phase");

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

    logger.debug("Timeline output", { output: result });

    return result;
  } catch (error) {
    if (isClassifyError(error)) {
      return mapClassifyError(
        error,
        "collectTimeline",
        ClarifyUnresolvedReasonEnum.enum.timeline,
      );
    }

    throw error;
  }
};
