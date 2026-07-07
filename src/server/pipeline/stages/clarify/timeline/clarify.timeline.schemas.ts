import { z } from "zod";

import {
  AskWithClassifyBaseSchema,
  ClassifyErroredReasonEnum,
} from "#pipeline/ask-with-classify";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { PipelineStatusEnum, TimelineBucketEnum } from "#schemas/pipeline.schemas";

export const TimelineClassifySchema = AskWithClassifyBaseSchema.extend({
  timeline: TimelineBucketEnum.nullable(),
});

export const TimelineClassifyResolvedSchema = TimelineClassifySchema.extend({
  timeline: TimelineBucketEnum,
});

export const TimelinePhaseResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: PipelineStatusEnum.extract(["completed"]),
    timeline: TimelineBucketEnum,
  }),
  z.object({
    status: PipelineStatusEnum.extract(["unresolved"]),
    reason: ClarifyUnresolvedReasonEnum.extract(["timeline"]),
  }),
  z.object({
    status: PipelineStatusEnum.extract(["errored"]),
    reason: ClassifyErroredReasonEnum.extract([
      "classify_resolved_output_invalid",
      "classify_message_missing",
    ]),
  }),
]);
