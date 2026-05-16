import { z } from "zod";

import {
  AskWithClassifyBaseSchema,
  ClassifyErroredReasonEnum,
} from "#pipeline/ask-with-classify";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { PipelineStatusEnum, RiskToleranceEnum } from "#schemas/pipeline.schemas";

const SelfRatingScoreSchema = z.number().int().min(1).max(5);

export const RiskClassifySchema = AskWithClassifyBaseSchema.extend({
  selfRatingScore: SelfRatingScoreSchema.nullable(),
});

export const RiskClassifyResolvedSchema = RiskClassifySchema.extend({
  selfRatingScore: SelfRatingScoreSchema,
});

// riskTolerance is derived from selfRatingScore in TypeScript, not by the model.
export const RiskPhaseOutputSchema = z.object({
  selfRatingScore: SelfRatingScoreSchema,
  riskTolerance: RiskToleranceEnum,
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
      "classify_output_invalid",
      "classify_message_missing",
    ]),
  }),
]);
