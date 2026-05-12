import { GoalClassificationEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";

export const GOAL_CLASSIFICATIONS = GoalClassificationEnum.options
  .map((o) => `\`${o}\``)
  .join(", ");

export const MAX_INTAKE_TOOL_CALLS = 5;
