import { z } from "zod";

import { MAX_AMOUNT } from "#constants/validation.constants";
import {
  AskWithClassifyBaseSchema,
  ClassifyErroredReasonEnum,
} from "#pipeline/ask-with-classify";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { PipelineStatusEnum, TimelineBucketEnum } from "#schemas/pipeline.schemas";

const AmountSchema = z.number().int().positive().max(MAX_AMOUNT);

export const AmountClassifySchema = AskWithClassifyBaseSchema.extend({
  amount: AmountSchema.nullable(),
});

export const AmountClassifyResolvedSchema = AmountClassifySchema.extend({
  amount: AmountSchema,
});

export const TimelineClassifySchema = AskWithClassifyBaseSchema.extend({
  timeline: TimelineBucketEnum.nullable(),
});

export const TimelineClassifyResolvedSchema = TimelineClassifySchema.extend({
  timeline: TimelineBucketEnum,
});

export const ParametersPhaseOutputSchema = z.object({
  amount: AmountSchema,
  timeline: TimelineBucketEnum,
});

export const ParametersPhaseResultSchema = z.discriminatedUnion("status", [
  z
    .object({ status: PipelineStatusEnum.extract(["completed"]) })
    .merge(ParametersPhaseOutputSchema),
  z.object({
    status: PipelineStatusEnum.extract(["unresolved"]),
    reason: ClarifyUnresolvedReasonEnum.extract(["amount", "timeline"]),
  }),
  z.object({
    status: PipelineStatusEnum.extract(["errored"]),
    reason: ClassifyErroredReasonEnum.extract([
      "classify_resolved_output_invalid",
      "classify_message_missing",
    ]),
  }),
]);
