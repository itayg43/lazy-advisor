import { z } from "zod";

export const CurrencyEnum = z.enum(["USD", "ILS"]);

export const RiskToleranceEnum = z.enum(["conservative", "moderate", "aggressive"]);

export const KnowledgeLevelEnum = z.enum(["beginner", "intermediate", "advanced"]);

export const UserProfileSchema = z.object({
  goal: z.string().min(1),
  currency: CurrencyEnum,
  monthlyBudget: z.number().positive().int(),
  riskTolerance: RiskToleranceEnum,
  investmentHorizon: z.string().min(1),
  knowledgeLevel: KnowledgeLevelEnum,
});
