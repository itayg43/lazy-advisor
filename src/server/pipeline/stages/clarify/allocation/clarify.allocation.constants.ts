import { RiskToleranceEnum, TimelineBucketEnum } from "#schemas/pipeline.schemas";
import type { RiskTolerance, TimelineBucket } from "#types/pipeline.types";

const {
  "3–5 years": t3to5,
  "5–10 years": t5to10,
  "10+ years": t10plus,
} = TimelineBucketEnum.enum;

export const ALLOCATION_RISK_LEVELS = RiskToleranceEnum.options
  .map((o) => `\`${o}\``)
  .join(", ");

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
  RiskTolerance,
  Record<AllocationTimeline, AllocationSuggestedEquityRange>
>;
