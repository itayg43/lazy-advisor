import { z } from "zod";

import {
  MAX_AGE,
  MAX_AMOUNT,
  MAX_MONTHLY_CONTRIBUTION,
  MAX_STRING_LENGTH,
} from "#constants/validation.constants";
import { RiskTolerance } from "#schemas/pipeline.schema";

export const GoalClassification = z.enum([
  "normal",
  "out_of_scope",
  "unrealistic",
  "contradictory",
]);

export const GoalClassificationSchema = z.object({
  type: GoalClassification,
});

export const FieldsPhaseOutputSchema = z.object({
  goal: z.string().min(1).max(MAX_STRING_LENGTH),
  amount: z.number().int().positive().max(MAX_AMOUNT),
  age: z.number().int().positive().max(MAX_AGE),
  timeline: z.string().min(1).max(MAX_STRING_LENGTH),
  hasEmergencyFund: z.boolean(),
  hasDebt: z.boolean(),
  monthlyContribution: z.number().nonnegative().int().max(MAX_MONTHLY_CONTRIBUTION),
});

export const RiskPhaseOutputSchema = z.object({
  riskTolerance: RiskTolerance,
});

export const PreferencesPhaseOutputSchema = z.object({
  investmentPreferences: z.string().min(1).max(MAX_STRING_LENGTH),
});
