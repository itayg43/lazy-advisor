import { z } from "zod";

export const RiskTolerance = z.enum(["conservative", "moderate", "aggressive"]);

export const KnowledgeLevel = z.enum(["beginner", "intermediate", "advanced"]);

const MAX_STRING_LENGTH = 256;
const MAX_AGE = 120;
const MAX_AMOUNT = 100_000_000;
const MAX_MONTHLY_CONTRIBUTION = 1_000_000;

export const UserProfileSchema = z.object({
  goal: z.string().min(1).max(MAX_STRING_LENGTH),
  amount: z.number().int().positive().max(MAX_AMOUNT),
  age: z.number().int().positive().max(MAX_AGE),
  riskTolerance: RiskTolerance,
  timeline: z.string().min(1).max(MAX_STRING_LENGTH),
  location: z.string().min(1).max(MAX_STRING_LENGTH),
  knowledgeLevel: KnowledgeLevel,
  brokerage: z.string().min(1).max(MAX_STRING_LENGTH).default("none"),
  investmentPreferences: z.string().min(1).max(MAX_STRING_LENGTH).default("none"),
  hasEmergencyFund: z.boolean(),
  hasDebt: z.boolean(),
  monthlyContribution: z.number().nonnegative().int().max(MAX_MONTHLY_CONTRIBUTION),
});
