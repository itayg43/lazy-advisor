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
  sourceUrl: z.string().min(1).max(MAX_STRING_LENGTH), // .url() omitted — OpenAI structured outputs reject "format": "uri"
});

const ResearchCategorySchema = z.object({
  allocationCategory: z.string().min(1).max(MAX_STRING_LENGTH),
  percentage: z.number().int().min(0).max(100),
  etfs: z.array(RecommendedEtfSchema).min(1),
});

export const ResearchSummarySchema = z
  .object({
    categories: z.array(ResearchCategorySchema).min(1),
  })
  .refine((s) => s.categories.reduce((sum, c) => sum + c.percentage, 0) === 100, {
    message: "Category percentages must sum to 100",
  });
