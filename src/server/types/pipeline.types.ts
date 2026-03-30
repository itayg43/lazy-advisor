import { z } from "zod";

import type {
  ResearchSummarySchema,
  UserProfileSchema,
} from "#server/schemas/pipeline.schema";

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type ResearchSummary = z.infer<typeof ResearchSummarySchema>;
