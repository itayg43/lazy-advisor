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

const AllocationSliceSchema = z.object({
  category: z.string().min(1).max(MAX_STRING_LENGTH),
  percentage: z.number().int().min(0).max(100),
});

export const AllocationPlanSchema = z
  .object({
    slices: z.array(AllocationSliceSchema).min(1),
  })
  .refine((plan) => plan.slices.reduce((sum, s) => sum + s.percentage, 0) === 100, {
    message: "Allocation slices must sum to 100",
  });

export const RecommendedEtfSchema = z.object({
  ticker: z.string().min(1).max(20),
  name: z.string().min(1).max(MAX_STRING_LENGTH),
  expenseRatio: z.number().nonnegative().max(100),
  trackingIndex: z.string().min(1).max(MAX_STRING_LENGTH).default("none"),
  sourceUrl: z.string().url(),
});

const ResearchCategorySchema = z.object({
  allocationCategory: z.string().min(1).max(MAX_STRING_LENGTH),
  etfs: z.array(RecommendedEtfSchema).min(1),
});

export const ResearchSummarySchema = z.object({
  categories: z.array(ResearchCategorySchema).min(1),
});

export const ResearchStageResultSchema = z.object({
  allocationPlan: AllocationPlanSchema,
  researchSummary: ResearchSummarySchema,
});
