import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { createLogger } from "#lib/logger";
import { MAX_INTAKE_TOOL_CALLS } from "#pipeline/stages/clarify/shared/clarify.constants";
import { runPhaseLoop } from "#pipeline/stages/clarify/shared/clarify.lib";
import { IntakeExtractionSchema } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("clarifyIntake");

export type IntakeResult = { accepted: true; alignedGoal: string } | { accepted: false };

const buildIntakeExtractionInstructions = (goal: string) =>
  `The user's original goal was: "${goal}"

Based on the preceding intake conversation, determine:
1. Did the user accept the proposed direction? Set accepted to true only if they agreed to proceed with a different investment approach (e.g., ETF investing, a realistic timeline, or clarified risk tolerance). Set to false if they declined or disengaged.
2. If accepted, write the aligned goal — a concise statement of the investment direction the user agreed to proceed with, derived from the original goal and any clarifications made during the conversation. Set to null if rejected.

Examples:
- Original: "Should I buy NVIDIA stock?", user agreed to ETFs → accepted: true, alignedGoal: "Invest in a tech ETF (e.g., NASDAQ-100) rather than individual stocks"
- Original: "I want to double ₪18,000 in 6 months", user pivoted to long-term → accepted: true, alignedGoal: "Invest ₪18,000 with a realistic long-term horizon of around 10 years"
- Original: "Max returns but can't lose money", user resolved contradiction → accepted: true, alignedGoal: "Invest for growth, comfortable holding through a 20% temporary drop"
- User refused to change approach or disengaged → accepted: false, alignedGoal: null`;

export const runIntakePhase = async (
  instructions: string,
  phaseName: string,
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<IntakeResult> => {
  logger.info(`Starting ${phaseName}`);

  const { responseId } = await runPhaseLoop(
    instructions,
    { input: goal },
    MAX_INTAKE_TOOL_CALLS,
    phaseName,
    sendToUser,
    waitForResponse,
  );

  const { output, usage } = await callOpenAIParsed<
    z.infer<typeof IntakeExtractionSchema>
  >({
    model: "gpt-5.4-nano",
    instructions: buildIntakeExtractionInstructions(goal),
    input: [],
    previous_response_id: responseId,
    text: { format: zodTextFormat(IntakeExtractionSchema, "IntakeExtraction") },
    reasoning: { effort: "low" },
  });

  logger.info(`${phaseName} extraction complete`, { accepted: output.accepted, usage });

  if (output.accepted && output.alignedGoal !== null) {
    logger.info(`${phaseName} accepted`, { alignedGoal: output.alignedGoal });

    return { accepted: true, alignedGoal: output.alignedGoal };
  }

  return { accepted: false };
};
