import { z } from "zod";

import { MAX_AGE, MAX_AMOUNT } from "#constants/validation.constants";

export const RiskTolerance = z.enum(["conservative", "moderate", "aggressive"]);

export const TimelineBucket = z.enum([
  "under 3 years",
  "3–5 years",
  "5–10 years",
  "10+ years",
]);

export const UserProfileSchema = z.object({
  amount: z.number().int().positive().max(MAX_AMOUNT),
  age: z.number().int().positive().max(MAX_AGE),
  timeline: TimelineBucket,
  hasEmergencyFund: z.boolean(),
  hasDebt: z.boolean(),
  riskTolerance: RiskTolerance,
  // sum-to-100 is validated in AllocationPhaseOutputSchema, not here
  equityPercentage: z.number().int().min(0).max(100),
  bufferPercentage: z.number().int().min(0).max(100),
  plansToContribute: z.boolean(),
});
