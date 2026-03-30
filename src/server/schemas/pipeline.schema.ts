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
  hasEmergencyFund: z.boolean(),
  hasDebt: z.boolean(),
  monthlyContribution: z.number().nonnegative().int().max(MAX_MONTHLY_CONTRIBUTION),
});

const MAX_LONG_STRING_LENGTH = 1024;
const MAX_ETF_RECOMMENDATIONS = 10;

const RecommendedEtfSchema = z.object({
  ticker: z.string().min(1).max(5),
  name: z.string().min(1).max(MAX_STRING_LENGTH),
  expenseRatio: z.string().min(1).max(16),
  reasoning: z.string().min(1).max(MAX_LONG_STRING_LENGTH),
  risks: z.string().min(1).max(MAX_LONG_STRING_LENGTH),
  sourceUrl: z.string().url(),
});

export const ResearchSummarySchema = z.object({
  recommendedEtfs: z.array(RecommendedEtfSchema).min(1).max(MAX_ETF_RECOMMENDATIONS),
  brokerageRecommendation: z.string().min(1).max(MAX_LONG_STRING_LENGTH),
  allocationRationale: z.string().min(1).max(MAX_LONG_STRING_LENGTH),
});
