import { z } from "zod";

import {
  AskWithClassifyBaseSchema,
  ClassifyErroredReasonEnum,
} from "#pipeline/ask-with-classify";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

export const RiskSelfRatingScoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const RiskClassifySchema = AskWithClassifyBaseSchema.extend({
  riskSelfRatingScore: RiskSelfRatingScoreSchema.nullable(),
});

export const RiskClassifyResolvedSchema = RiskClassifySchema.extend({
  riskSelfRatingScore: RiskSelfRatingScoreSchema,
});

export const RiskPhaseOutputSchema = z.object({
  riskSelfRatingScore: RiskSelfRatingScoreSchema,
});

export const RiskPhaseResultSchema = z.discriminatedUnion("status", [
  z
    .object({ status: PipelineStatusEnum.extract(["completed"]) })
    .merge(RiskPhaseOutputSchema),
  z.object({
    status: PipelineStatusEnum.extract(["unresolved"]),
    reason: ClarifyUnresolvedReasonEnum.extract(["risk_tolerance"]),
  }),
  z.object({
    status: PipelineStatusEnum.extract(["errored"]),
    reason: ClassifyErroredReasonEnum.extract([
      "classify_resolved_output_invalid",
      "classify_message_missing",
    ]),
  }),
]);
