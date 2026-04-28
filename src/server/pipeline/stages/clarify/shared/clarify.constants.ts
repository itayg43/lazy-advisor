import { GoalClassification } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { RiskTolerance, TimelineBucket } from "#schemas/pipeline.schemas";

const {
  "under 3 years": under3,
  "3–5 years": t3to5,
  "5–10 years": t5to10,
  "10+ years": t10plus,
} = TimelineBucket.enum;

export const TIMELINE_BUCKETS = TimelineBucket.options.map((o) => `\`${o}\``).join(", ");
export const TIMELINE_BUCKET_LIST = TimelineBucket.options
  .map((o, i) => `${i + 1}. ${o}`)
  .join("\n");
export const TIMELINE_BOUNDARY_EXAMPLES = `"3 years" → "${under3}" (not "${t3to5}"), "5 years" → "${t3to5}" (not "${t5to10}"), "10 years" → "${t5to10}" (not "${t10plus}" — "${t10plus}" means strictly more than 10 years)`;

export const RISK_LEVELS = RiskTolerance.options.map((o) => `\`${o}\``).join(", ");

type AllocationTimeline = Exclude<
  (typeof TimelineBucket.options)[number],
  "under 3 years"
>;

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
  (typeof RiskTolerance.options)[number],
  Record<AllocationTimeline, { min: number; max: number }>
>;

const buildAnchorTable = (): string => {
  const timelines = TimelineBucket.options.filter(
    (o): o is AllocationTimeline => o !== under3,
  );
  const header = `| Willingness \\ Timeline | ${timelines.join(" | ")} |`;
  const separator = `|${"---|".repeat(timelines.length + 1)}`;
  const rows = RiskTolerance.options.map((risk) => {
    const cells = timelines.map((t) => {
      const { min, max } = ALLOCATION_ANCHOR_DATA[risk][t];

      return min === max ? `${min}%` : `${min}–${max}%`;
    });

    return `| ${risk} | ${cells.join(" | ")} |`;
  });

  return [header, separator, ...rows].join("\n");
};

export const ALLOCATION_ANCHOR_TABLE = buildAnchorTable();
export const ALLOCATION_TIMELINE_BUCKETS = TimelineBucket.options
  .filter((o) => o !== under3)
  .map((o) => `\`${o}\``)
  .join(", ");

export const GOAL_CLASSIFICATIONS = GoalClassification.options
  .map((o) => `\`${o}\``)
  .join(", ");

export const INTAKE_REJECTION_DEFAULT_MESSAGE =
  "No problem — feel free to come back when you're ready.";

export const INTAKE_REJECTION_MESSAGES: Partial<
  Record<(typeof GoalClassification.options)[number], string>
> = {
  [GoalClassification.enum.out_of_scope]:
    "No problem — feel free to come back when you're ready to explore ETF-based investing.",
  [GoalClassification.enum.unrealistic]:
    "No problem — feel free to come back when you're ready to explore a realistic long-term plan.",
  [GoalClassification.enum.contradictory]:
    "No problem — feel free to come back when you have a clearer picture of your risk tolerance.",
};

export const PROFILE_TRANSITION_MESSAGE =
  "I'll now ask you a few questions to understand your financial situation and investment preferences — your answers will shape the plan we build together.";

export const AMOUNT_EXIT_MESSAGE =
  "To build your investment plan I need a specific amount — feel free to come back when you have a figure in mind.";

export const SHORT_TIMELINE_EXIT_MESSAGE =
  "For money you plan to use within 3 years, ETFs carry too much timing risk — a market drop right before you need the funds may be hard to recover from in time. A money market fund is a better fit: lower risk, stays accessible, and still earns meaningful returns. When you're ready to invest money for a longer horizon, come back and we'll build an ETF plan.";

export const MAX_INTAKE_TOOL_CALLS = 5;
export const MAX_EF_DEBT_TOOL_CALLS = 4;
export const MAX_FIELDS_TOOL_CALLS = 5;
export const MAX_CONTRIBUTION_TOOL_CALLS = 5;
export const MAX_RISK_TOOL_CALLS = 3;
export const MAX_ALLOCATION_TOOL_CALLS = 5;
