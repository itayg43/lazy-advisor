import { z } from "zod";

import { MAX_AMOUNT } from "#constants/validation.constants";
import {
  PipelineStatusEnum,
  RiskToleranceEnum,
  TimelineBucketEnum,
} from "#schemas/pipeline.schemas";

export const GoalClassificationEnum = z.enum([
  "normal",
  "out_of_scope",
  "unrealistic",
  "contradictory",
]);

export const GoalClassificationSchema = z.object({
  type: GoalClassificationEnum,
});

export const ClarifyUnresolvedReasonEnum = z.enum([
  "amount",
  "timeline",
  "risk_tolerance",
  "allocation",
]);

export const ClarifyHaltReasonEnum = z.enum(["short_timeline", "intake_rejected"]);

export const ClarifyErroredReasonEnum = z.enum([
  "classify_output_invalid",
  "classify_message_missing",
]);

export const IntakePhaseOutputSchema = z.object({
  accepted: z.boolean(),
});

export const ParametersPhaseOutputSchema = z.object({
  amount: z.number().int().positive().max(MAX_AMOUNT),
  timeline: TimelineBucketEnum,
});

export const ParametersPhaseResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: PipelineStatusEnum.extract(["completed"]),
    parameters: ParametersPhaseOutputSchema,
  }),
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

export const AllocationPhaseOutputSchema = z
  .object({
    equityPercentage: z.number().int().min(0).max(100),
    bufferPercentage: z.number().int().min(0).max(100),
  })
  .refine((v) => v.equityPercentage + v.bufferPercentage === 100, {
    message: "equityPercentage + bufferPercentage must equal 100",
  });

export const AllocationPhaseResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: PipelineStatusEnum.extract(["completed"]),
    allocation: AllocationPhaseOutputSchema,
  }),
  z.object({
    status: PipelineStatusEnum.extract(["unresolved"]),
    reason: ClarifyUnresolvedReasonEnum.extract(["allocation"]),
  }),
]);

// Contribution is non-blocking by design — all classify-error modes collapse to
// `plansToContribute: false` inside the phase (mirrors ef-debt's safe-fallback
// pattern). The phase therefore has a single terminal status; no discriminated
// union needed.
export const ContributionPhaseResultSchema = z.object({
  status: PipelineStatusEnum.extract(["completed"]),
  plansToContribute: z.boolean(),
});
