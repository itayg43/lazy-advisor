import { z } from "zod";

export const RiskToleranceEnum = z.enum(["conservative", "moderate", "aggressive"]);

export const KnowledgeLevelEnum = z.enum(["beginner", "intermediate", "advanced"]);

export const UserProfileSchema = z.object({
  goal: z.string().min(1),
  amount: z.number().positive(),
  age: z.number().int().positive(),
  riskTolerance: RiskToleranceEnum,
  timeline: z.string().min(1),
  location: z.string().min(1),
  knowledgeLevel: KnowledgeLevelEnum,
  brokerage: z.string().min(1),
  hasEmergencyFund: z.boolean(),
  hasDebt: z.boolean(),
  monthlyContribution: z.number().nonnegative().int(),
});
