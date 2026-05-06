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

// LLM-facing schema — permits null amount that the phase converts into the amount_missing failure result.
export const ParametersExtractionSchema = z.object({
  amount: z.number().int().positive().max(MAX_AMOUNT).nullable(),
  timeline: TimelineBucket,
});

// Orchestrator-facing wrapper: the Output payload on success, or a graceful failure code.
export const ParametersPhaseResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), parameters: ParametersPhaseOutputSchema }),
  z.object({ status: z.literal("failure"), code: z.literal("amount_missing") }),
]);

// LLM extraction shape — riskTolerance is derived from selfRatingScore in TypeScript, not by the model.
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

// Orchestrator-facing wrapper: the Output payload on success, or a graceful failure code.
export const AllocationPhaseResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), allocation: AllocationPhaseOutputSchema }),
  z.object({ status: z.literal("failure"), code: z.literal("split_unresolved") }),
]);

export const ContributionPhaseOutputSchema = z.object({
  plansToContribute: z.boolean(),
});
