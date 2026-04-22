import { z } from "zod";

import { MAX_AGE, MAX_AMOUNT, MAX_STRING_LENGTH } from "#constants/validation.constants";

export const RiskTolerance = z.enum(["conservative", "moderate", "aggressive"]);

export const UserProfileSchema = z.object({
  amount: z.number().int().positive().max(MAX_AMOUNT),
  age: z.number().int().positive().max(MAX_AGE),
  timeline: z.string().min(1).max(MAX_STRING_LENGTH),
  hasEmergencyFund: z.boolean(),
  hasDebt: z.boolean(),
  riskTolerance: RiskTolerance,
  // sum-to-100 is validated in AllocationPhaseOutputSchema, not here
  equityPercentage: z.number().int().min(0).max(100),
  bufferPercentage: z.number().int().min(0).max(100),
  plansToContribute: z.boolean(),
});
