import { GoalClassification } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { RiskTolerance, TimelineBucket } from "#schemas/pipeline.schemas";

export const RISK_LEVELS = RiskTolerance.options.map((o) => `\`${o}\``).join(", ");
export const TIMELINE_BUCKETS = TimelineBucket.options.map((o) => `\`${o}\``).join(", ");
export const TIMELINE_BUCKET_LIST = TimelineBucket.options
  .map((o, i) => `${i + 1}. ${o}`)
  .join("\n");

type AnchorCell = { min: number; max: number };

const {
  "under 3 years": under3,
  "3–5 years": t3to5,
  "5–10 years": t5to10,
  "10+ years": t10plus,
} = TimelineBucket.enum;

export const TIMELINE_BOUNDARY_EXAMPLES = `"3 years" → "${under3}" (not "${t3to5}"), "5 years" → "${t3to5}" (not "${t5to10}"), "10 years" → "${t5to10}" (not "${t10plus}" — "${t10plus}" means strictly more than 10 years)`;

const ALLOCATION_ANCHOR_DATA = {
  conservative: {
    [under3]: { min: 0, max: 0 },
    [t3to5]: { min: 10, max: 20 },
    [t5to10]: { min: 30, max: 40 },
    [t10plus]: { min: 40, max: 50 },
  },
  moderate: {
    [under3]: { min: 0, max: 0 },
    [t3to5]: { min: 20, max: 30 },
    [t5to10]: { min: 50, max: 60 },
    [t10plus]: { min: 60, max: 70 },
  },
  aggressive: {
    [under3]: { min: 0, max: 0 },
    [t3to5]: { min: 30, max: 40 },
    [t5to10]: { min: 60, max: 70 },
    [t10plus]: { min: 80, max: 90 },
  },
} satisfies Record<
  (typeof RiskTolerance.options)[number],
  Record<(typeof TimelineBucket.options)[number], AnchorCell>
>;

const buildAnchorTable = (): string => {
  const timelines = TimelineBucket.options;
  const risks = RiskTolerance.options;
  const header = `| Willingness \\ Timeline | ${timelines.join(" | ")} |`;
  const separator = `|${"---|".repeat(timelines.length + 1)}`;
  const rows = risks.map((risk) => {
    const cells = timelines.map((t) => {
      const { min, max } = ALLOCATION_ANCHOR_DATA[risk][t];

      return min === max ? `${min}%` : `${min}–${max}%`;
    });

    return `| ${risk} | ${cells.join(" | ")} |`;
  });

  return [header, separator, ...rows].join("\n");
};

export const ALLOCATION_ANCHOR_TABLE = buildAnchorTable();
export const GOAL_CLASSIFICATIONS = GoalClassification.options
  .map((o) => `\`${o}\``)
  .join(", ");

export const PROFILE_TRANSITION_MESSAGE =
  "I'll now ask you a few questions to understand your financial situation and investment preferences — your answers will shape the plan we build together.";

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

export const MAX_INTAKE_TOOL_CALLS = 5;
export const MAX_FIELDS_TOOL_CALLS = 10;
export const MAX_CONTRIBUTION_TOOL_CALLS = 5;
export const MAX_RISK_TOOL_CALLS = 2;
export const MAX_ALLOCATION_TOOL_CALLS = 5;
