import { GoalClassification } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { RiskTolerance } from "#schemas/pipeline.schema";

export const RISK_LEVELS = RiskTolerance.options.map((o) => `\`${o}\``).join(", ");
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

export const MAX_INTAKE_TOOL_CALLS = 5;
export const MAX_FIELDS_TOOL_CALLS = 10;
export const MAX_CONTRIBUTION_TOOL_CALLS = 5;
export const MAX_PREFERENCES_TOOL_CALLS = 5;
export const MAX_RISK_TOOL_CALLS = 5;
