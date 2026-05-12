import { SHORT_TIMELINE_BUCKET } from "#pipeline/stages/clarify/shared/clarify.constants";
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

type AllocationTimeline = Exclude<TimelineBucket, "under 3 years">;

const ALLOCATION_ANCHOR_DATA = {
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
  Record<AllocationTimeline, { min: number; max: number }>
>;

const buildAnchorTable = (): string => {
  const timelines = TimelineBucketEnum.options.filter(
    (o): o is AllocationTimeline => o !== SHORT_TIMELINE_BUCKET,
  );
  const header = `| Willingness \\ Timeline | ${timelines.join(" | ")} |`;
  const separator = `|${"---|".repeat(timelines.length + 1)}`;
  const rows = RiskToleranceEnum.options.map((risk) => {
    const cells = timelines.map((t) => {
      const { min, max } = ALLOCATION_ANCHOR_DATA[risk][t];

      return min === max ? `${min}%` : `${min}–${max}%`;
    });

    return `| ${risk} | ${cells.join(" | ")} |`;
  });

  return [header, separator, ...rows].join("\n");
};

export const ALLOCATION_ANCHOR_TABLE = buildAnchorTable();
export const ALLOCATION_TIMELINE_BUCKETS = TimelineBucketEnum.options
  .filter((o) => o !== SHORT_TIMELINE_BUCKET)
  .map((o) => `\`${o}\``)
  .join(", ");

export const MAX_ALLOCATION_TOOL_CALLS = 5;
