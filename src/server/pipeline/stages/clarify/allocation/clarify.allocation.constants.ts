import { z } from "zod";

import { TimelineBucketEnum } from "#schemas/pipeline.schemas";
import type { TimelineBucket } from "#types/pipeline.types";

// Internal risk-tolerance buckets. Scoped to allocation: the only consumers are
// the anchor table keys and the banned-words list below. The bucket is never
// threaded through the pipeline or shown to the user — it's derived on demand
// from the user's `riskSelfRatingScore` via `mapRiskSelfRatingScoreToTolerance`.
export const AllocationRiskToleranceEnum = z.enum([
  "conservative",
  "moderate",
  "aggressive",
]);
export type AllocationRiskTolerance = z.infer<typeof AllocationRiskToleranceEnum>;

const {
  "3–5 years": t3to5,
  "5–10 years": t5to10,
  "10+ years": t10plus,
} = TimelineBucketEnum.enum;

export const ALLOCATION_RISK_LEVELS = AllocationRiskToleranceEnum.options
  .map((o) => `\`${o}\``)
  .join(", ");

export const ALLOCATION_MAX_NEGOTIATION_TURNS = 5;

export const ALLOCATION_MISSING_COUNTER_MESSAGE =
  "I didn't catch a specific percentage. Could you tell me what split you'd like, or reply 'yes' to accept the current one?";

export const ALLOCATION_UNKNOWN_INTENT_MESSAGE =
  "I didn't catch that. Want the proposed split, more in stocks, or more in buffer?";

export const ALLOCATION_EXTREME_DEVIATION_PERCENTAGE_POINTS = 40;

export type AllocationTimeline = Exclude<TimelineBucket, "under 3 years">;

export type AllocationSuggestedEquityRange = { min: number; max: number };

export const ALLOCATION_ANCHOR_DATA = {
  conservative: {
    [t3to5]: { min: 10, max: 20 },
    [t5to10]: { min: 30, max: 40 },
    [t10plus]: { min: 40, max: 50 },
  },
  moderate: {
    [t3to5]: { min: 20, max: 30 },
    [t5to10]: { min: 50, max: 60 },
    [t10plus]: { min: 60, max: 70 },
  },
  aggressive: {
    [t3to5]: { min: 30, max: 40 },
    [t5to10]: { min: 60, max: 70 },
    [t10plus]: { min: 80, max: 90 },
  },
} satisfies Record<
  AllocationRiskTolerance,
  Record<AllocationTimeline, AllocationSuggestedEquityRange>
>;
