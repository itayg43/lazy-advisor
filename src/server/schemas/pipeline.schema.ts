import { z } from "zod";

export const RiskTolerance = z.enum(["conservative", "moderate", "aggressive"]);

export const KnowledgeLevel = z.enum(["beginner", "intermediate", "advanced"]);

export const UserProfileSchema = z.object({
  goal: z.string().min(1),
  amount: z.number().int().positive(),
  age: z.number().int().positive(),
  riskTolerance: RiskTolerance,
  timeline: z.string().min(1),
  location: z.string().min(1),
  knowledgeLevel: KnowledgeLevel,
  brokerage: z.string().min(1),
  hasEmergencyFund: z.boolean(),
  hasDebt: z.boolean(),
  monthlyContribution: z.number().nonnegative().int(),
});
