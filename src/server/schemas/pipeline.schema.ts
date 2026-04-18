import { z } from "zod";

import { MAX_AGE, MAX_AMOUNT, MAX_STRING_LENGTH } from "#constants/validation.constants";

export const RiskTolerance = z.enum(["conservative", "moderate", "aggressive"]);

export const UserProfileSchema = z.object({
  goal: z.string().min(1).max(MAX_STRING_LENGTH),
  amount: z.number().int().positive().max(MAX_AMOUNT),
  age: z.number().int().positive().max(MAX_AGE),
  riskTolerance: RiskTolerance,
  timeline: z.string().min(1).max(MAX_STRING_LENGTH),
  investmentPreferences: z.string().min(1).max(MAX_STRING_LENGTH),
  hasEmergencyFund: z.boolean(),
  hasDebt: z.boolean(),
  plansToContribute: z.boolean(),
});
