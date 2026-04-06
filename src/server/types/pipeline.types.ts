import { z } from "zod";

import type {
  AllocationPlanSchema,
  RecommendedEtfSchema,
  ResearchStageResultSchema,
  ResearchSummarySchema,
  UserProfileSchema,
} from "#schemas/pipeline.schema";

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type AllocationPlan = z.infer<typeof AllocationPlanSchema>;
export type RecommendedEtf = z.infer<typeof RecommendedEtfSchema>;
export type ResearchSummary = z.infer<typeof ResearchSummarySchema>;
export type ResearchStageResult = z.infer<typeof ResearchStageResultSchema>;
