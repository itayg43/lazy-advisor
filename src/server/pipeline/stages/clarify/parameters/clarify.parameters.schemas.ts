import { z } from "zod";

import { MAX_AMOUNT } from "#constants/validation.constants";
import { AskWithClassifyBaseSchema } from "#pipeline/stages/clarify/shared/clarify.ask";
import {
  ClarifyErroredReasonEnum,
  ClarifyUnresolvedReasonEnum,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import { PipelineStatusEnum, TimelineBucketEnum } from "#schemas/pipeline.schemas";

export const AmountClassifySchema = AskWithClassifyBaseSchema.extend({
  amount: z.number().int().positive().max(MAX_AMOUNT).nullable(),
});

export const AmountClassifyResolvedSchema = AmountClassifySchema.extend({
  amount: z.number().int().positive().max(MAX_AMOUNT),
});

export const TimelineClassifySchema = AskWithClassifyBaseSchema.extend({
  timeline: TimelineBucketEnum.nullable(),
});

export const TimelineClassifyResolvedSchema = TimelineClassifySchema.extend({
  timeline: TimelineBucketEnum,
});

export const ParametersPhaseOutputSchema = z.object({
  amount: z.number().int().positive().max(MAX_AMOUNT),
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
    reason: ClarifyErroredReasonEnum.extract([
      "classify_output_invalid",
      "classify_message_missing",
    ]),
  }),
]);
