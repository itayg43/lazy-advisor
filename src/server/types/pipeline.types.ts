import { z } from "zod";

import type {
  AllocationPlanSchema,
  RecommendedEtfSchema,
  ResearchSummarySchema,
  UserProfileSchema,
} from "#schemas/pipeline.schema";

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type AllocationPlan = z.infer<typeof AllocationPlanSchema>;
export type RecommendedEtf = z.infer<typeof RecommendedEtfSchema>;
export type ResearchSummary = z.infer<typeof ResearchSummarySchema>;
