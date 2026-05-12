import { z } from "zod";

import {
  ClarifyErroredReasonEnum,
  ClarifyUnresolvedReasonEnum,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import { PipelineStatusEnum, RiskToleranceEnum } from "#schemas/pipeline.schemas";

// riskTolerance is derived from selfRatingScore in TypeScript, not by the model.
export const RiskPhaseOutputSchema = z.object({
  selfRatingScore: z.number().int().min(1).max(5),
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
    reason: ClarifyErroredReasonEnum.extract([
      "classify_output_invalid",
      "classify_message_missing",
    ]),
  }),
]);
