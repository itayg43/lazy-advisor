import { GoalClassificationEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  ClarifyHaltReason,
  ClarifyUnresolvedReason,
  RedirectingClassification,
} from "#pipeline/stages/clarify/shared/clarify.types";
import { TimelineBucketEnum } from "#schemas/pipeline.schemas";

// Disqualifying timeline — stage halts here instead of running profile collection,
// and allocation excludes it from the anchor table.
export const SHORT_TIMELINE_BUCKET = TimelineBucketEnum.enum["under 3 years"];

export const PROFILE_TRANSITION_MESSAGE =
  "I'll now ask you a few questions to understand your financial situation and investment preferences — your answers will shape the plan we build together.";

export const AMOUNT_EXIT_MESSAGE =
  "We couldn't settle on a specific amount — feel free to come back when you have a figure in mind.";

export const TIMELINE_EXIT_MESSAGE =
  "We couldn't settle on a timeframe for when you'd like to use the money — feel free to come back when you have one in mind.";

export const SHORT_TIMELINE_EXIT_MESSAGE =
  "For money you plan to use within 3 years, ETFs carry too much timing risk — a market drop right before you need the funds may be hard to recover from in time. A money market fund is a better fit: lower risk, stays accessible, and still earns meaningful returns. When you're ready to invest money for a longer horizon, come back and we'll build an ETF plan.";

export const RISK_EXIT_MESSAGE =
  "We couldn't settle on how much volatility you're comfortable with — feel free to come back when you have a sense of your risk tolerance.";

export const ALLOCATION_EXIT_MESSAGE =
  "We couldn't settle on an equity/buffer split that fits — feel free to come back when you've had time to think it over.";

export const CLARIFY_UNRESOLVED_MESSAGES: Record<ClarifyUnresolvedReason, string> = {
  amount: AMOUNT_EXIT_MESSAGE,
  timeline: TIMELINE_EXIT_MESSAGE,
  risk_tolerance: RISK_EXIT_MESSAGE,
  allocation: ALLOCATION_EXIT_MESSAGE,
};

// `intake_rejected` is intentionally absent — its message depends on the carried
// classification and is resolved via INTAKE_REDIRECT_REJECTION_MESSAGES.
export const CLARIFY_HALT_MESSAGES: Record<
  Exclude<ClarifyHaltReason, "intake_rejected">,
  string
> = {
  short_timeline: SHORT_TIMELINE_EXIT_MESSAGE,
};

export const INTAKE_REDIRECT_REJECTION_MESSAGES: Record<
  RedirectingClassification,
  string
> = {
  [GoalClassificationEnum.enum.out_of_scope]:
    "No problem — feel free to come back when you're ready to explore ETF-based investing.",
  [GoalClassificationEnum.enum.unrealistic]:
    "No problem — feel free to come back when you're ready to explore a realistic long-term plan.",
  [GoalClassificationEnum.enum.contradictory]:
    "No problem — feel free to come back when you have a clearer picture of your risk tolerance.",
};
