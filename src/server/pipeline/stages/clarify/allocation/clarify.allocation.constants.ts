import type { RiskTolerance } from "#pipeline/stages/clarify/risk/clarify.risk.types";
import { TimelineBucketEnum } from "#schemas/pipeline.schemas";
import type { TimelineBucket } from "#types/pipeline.types";

const {
  "3–5 years": t3to5,
  "5–10 years": t5to10,
  "10+ years": t10plus,
} = TimelineBucketEnum.enum;

// The advisor must never pin a risk personality on the user — not "you're an
// aggressive investor", not "your moderate profile", not any "you're a ___
// investor" label. This is a UX rule (don't hand a beginner a risk identity off
// a single 1–5 self-rating), enforced in the composer prompts and graded by the
// allocation judge's `no-risk-labeling` criterion. These three words are the
// most common such labels, kept here as the illustrative examples injected into
// the prompt instruction — not an exhaustive denylist (the rule is broader than
// any fixed word set, and plain uses like "a moderate amount" are fine).
export const ALLOCATION_RISK_LABEL_EXAMPLES = ["conservative", "moderate", "aggressive"]
  .map((w) => `\`${w}\``)
  .join(", ");

export const ALLOCATION_MAX_NEGOTIATION_TURNS = 5;

export const ALLOCATION_MISSING_COUNTER_MESSAGE =
  "I didn't catch a specific percentage. Could you tell me what split you'd like, or reply 'yes' to accept the current one?";

export const ALLOCATION_UNKNOWN_INTENT_MESSAGE =
  "I didn't catch that. Want the proposed split, more in stocks, or more in buffer?";

export const ALLOCATION_EXTREME_DEVIATION_PERCENTAGE_POINTS = 40;

export type AllocationTimeline = Exclude<TimelineBucket, "under 3 years">;

export type AllocationSuggestedEquityRange = { min: number; max: number };

// Keyed directly by the 1–5 `riskTolerance` score × timeline. Scores pair up by
// design: 1 and 2 share the cautious range, 4 and 5 share the bold range, with
// `deriveAnchorEquityPercentage` splitting each shared range's low/high edge by
// score. The duplicated rows (1≡2, 4≡5) are intentional — the prior version
// collapsed the score into a conservative/moderate/aggressive bucket to avoid
// the duplication, but that bucket had no other reader and only added a mapping
// step, so the table now carries the score directly.
export const ALLOCATION_ANCHOR_DATA = {
  1: {
    [t3to5]: { min: 10, max: 20 },
    [t5to10]: { min: 30, max: 40 },
    [t10plus]: { min: 40, max: 50 },
  },
  2: {
    [t3to5]: { min: 10, max: 20 },
    [t5to10]: { min: 30, max: 40 },
    [t10plus]: { min: 40, max: 50 },
  },
  3: {
    [t3to5]: { min: 20, max: 30 },
    [t5to10]: { min: 50, max: 60 },
    [t10plus]: { min: 60, max: 70 },
  },
  4: {
    [t3to5]: { min: 30, max: 40 },
    [t5to10]: { min: 60, max: 70 },
    [t10plus]: { min: 80, max: 90 },
  },
  5: {
    [t3to5]: { min: 30, max: 40 },
    [t5to10]: { min: 60, max: 70 },
    [t10plus]: { min: 80, max: 90 },
  },
} satisfies Record<
  RiskTolerance,
  Record<AllocationTimeline, AllocationSuggestedEquityRange>
>;
