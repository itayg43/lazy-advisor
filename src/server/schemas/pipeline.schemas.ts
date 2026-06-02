import { z } from "zod";

import { MAX_AMOUNT } from "#constants/validation.constants";

export const PipelineStatusEnum = z.enum([
  "completed",
  "halted",
  "unresolved",
  "errored",
]);

export const RiskToleranceEnum = z.enum(["conservative", "moderate", "aggressive"]);

export const TimelineBucketEnum = z.enum([
  "under 3 years",
  "3–5 years",
  "5–10 years",
  "10+ years",
]);

export const UserProfileSchema = z.object({
  amount: z.number().int().positive().max(MAX_AMOUNT),
  timeline: TimelineBucketEnum,
  riskTolerance: RiskToleranceEnum,
  // sum-to-100 is validated by AllocationPhaseResultSchema in collectAllocation, not here
  equityPercentage: z.number().int().min(0).max(100),
  bufferPercentage: z.number().int().min(0).max(100),
  plansToContribute: z.boolean(),
});
