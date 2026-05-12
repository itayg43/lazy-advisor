import { GoalClassificationEnum } from "#pipeline/stages/clarify/intake/clarify.intake.schemas";
import type { RedirectingClassification } from "#pipeline/stages/clarify/intake/clarify.intake.types";

export const GOAL_CLASSIFICATIONS = GoalClassificationEnum.options
  .map((o) => `\`${o}\``)
  .join(", ");

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

export const MAX_INTAKE_TOOL_CALLS = 5;
