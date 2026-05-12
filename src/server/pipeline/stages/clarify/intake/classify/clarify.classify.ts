import { zodTextFormat } from "openai/helpers/zod";

import { createLogger } from "#lib/logger";
import { GOAL_CLASSIFICATIONS } from "#pipeline/stages/clarify/intake/clarify.intake.constants";
import {
  GoalClassificationEnum,
  GoalClassificationSchema,
} from "#pipeline/stages/clarify/intake/clarify.intake.schemas";
import type { GoalClassificationOutput } from "#pipeline/stages/clarify/intake/clarify.intake.types";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("clarifyClassify");

const { out_of_scope, unrealistic, contradictory, normal } = GoalClassificationEnum.enum;

const CLASSIFY_SYSTEM_PROMPT = `# Role and Objective
You are a goal classifier for an investment advisor pipeline. Your sole job is to classify the user's initial investment goal into exactly one of: ${GOAL_CLASSIFICATIONS}.

# Classification Rules

- **${out_of_scope}**: The user is asking about individual stock picking, day trading, or direct crypto purchases (not crypto ETFs). Goals that combine ETF investing with individual stock picks (e.g., "I want ETFs but also buy NVIDIA") are also out_of_scope — the stock-picking component needs to be redirected.
- **${unrealistic}**: The user states a return expectation that is unrealistic for passive ETF investing — e.g., doubling capital in a few months, or expecting very high short-term guaranteed returns.
- **${contradictory}**: The user explicitly states conflicting risk signals in their goal — e.g., "I want maximum returns but I can't lose any money."
- **${normal}**: Everything else — including vague goals ("I want to invest"), crypto ETFs, sector preferences, or any goal that does not clearly match one of the above.

When in doubt, classify as **${normal}**.`;

export const classifyGoal = async (goal: string) => {
  const { output, usage } = await callOpenAIParsed<GoalClassificationOutput>({
    model: "gpt-5.4-nano",
    instructions: CLASSIFY_SYSTEM_PROMPT,
    input: goal,
    text: {
      format: zodTextFormat(GoalClassificationSchema, "GoalClassificationSchema"),
    },
    reasoning: { effort: "low" },
  });

  logger.info("Classification complete", { type: output.type, usage });

  return output.type;
};
