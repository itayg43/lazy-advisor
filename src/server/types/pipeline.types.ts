import type { z } from "zod";

import type {
  PipelineStatusEnum,
  RiskToleranceEnum,
  TimelineBucketEnum,
  UserProfileSchema,
} from "#schemas/pipeline.schemas";

export type PipelineStatus = z.infer<typeof PipelineStatusEnum>;
export type RiskTolerance = z.infer<typeof RiskToleranceEnum>;
export type TimelineBucket = z.infer<typeof TimelineBucketEnum>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
