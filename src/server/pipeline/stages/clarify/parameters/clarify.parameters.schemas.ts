import { z } from "zod";

import { MAX_AMOUNT } from "#constants/validation.constants";
import {
  ClarifyErroredReasonEnum,
  ClarifyUnresolvedReasonEnum,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import { PipelineStatusEnum, TimelineBucketEnum } from "#schemas/pipeline.schemas";

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
