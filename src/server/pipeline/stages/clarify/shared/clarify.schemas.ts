import { z } from "zod";

import { MAX_AMOUNT } from "#constants/validation.constants";
import { RiskTolerance, TimelineBucket } from "#schemas/pipeline.schemas";

export const GoalClassification = z.enum([
  "normal",
  "out_of_scope",
  "unrealistic",
  "contradictory",
]);

export const GoalClassificationSchema = z.object({
  type: GoalClassification,
});

export const IntakePhaseOutputSchema = z.object({
  accepted: z.boolean(),
});

export const ParametersPhaseOutputSchema = z.object({
  amount: z.number().int().positive().max(MAX_AMOUNT),
  timeline: TimelineBucket,
});

export const ParametersExtractionSchema = z.object({
  amount: z.number().int().positive().max(MAX_AMOUNT).nullable(),
  timeline: TimelineBucket,
});

export const ParametersPhaseResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), parameters: ParametersPhaseOutputSchema }),
  z.object({ status: z.literal("failure"), code: z.literal("amount_missing") }),
]);

export const RiskScoreSchema = z.object({
  selfRatingScore: z.number().int().min(1).max(5),
});

export const RiskPhaseOutputSchema = RiskScoreSchema.extend({
  riskTolerance: RiskTolerance,
});

export const AllocationPhaseOutputSchema = z
  .object({
    equityPercentage: z.number().int().min(0).max(100),
    bufferPercentage: z.number().int().min(0).max(100),
  })
  .refine((v) => v.equityPercentage + v.bufferPercentage === 100, {
    message: "equityPercentage + bufferPercentage must equal 100",
  });

export const ContributionPhaseOutputSchema = z.object({
  plansToContribute: z.boolean(),
});
