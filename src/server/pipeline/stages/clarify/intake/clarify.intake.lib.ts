import { zodTextFormat } from "openai/helpers/zod";

import { createLogger } from "#lib/logger";
import { MAX_INTAKE_TOOL_CALLS } from "#pipeline/stages/clarify/shared/clarify.constants";
import { runPhaseLoop } from "#pipeline/stages/clarify/shared/clarify.lib";
import { IntakePhaseOutputSchema } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { IntakePhaseOutput } from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("clarifyIntake");

const INTAKE_EXTRACTION_INSTRUCTIONS = `Based on the preceding intake conversation, determine whether the user accepted the proposed direction.

Set accepted to true if the user agreed to proceed (e.g., with ETF investing, a realistic timeline, or clarified risk tolerance). Set to false if they declined, disengaged, or showed no clear acceptance.`;

export const runIntakePhase = async (
  instructions: string,
  phaseName: string,
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<IntakePhaseOutput> => {
  logger.info(`Starting ${phaseName}`);

  const { responseId } = await runPhaseLoop({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions,
    input: goal,
    maxToolCalls: MAX_INTAKE_TOOL_CALLS,
    phaseName,
    sendToUser,
    waitForResponse,
  });

  const { output, usage } = await callOpenAIParsed<IntakePhaseOutput>({
    model: "gpt-5.4-nano",
    instructions: INTAKE_EXTRACTION_INSTRUCTIONS,
    input: [],
    previous_response_id: responseId,
    text: { format: zodTextFormat(IntakePhaseOutputSchema, "IntakePhaseOutputSchema") },
    reasoning: { effort: "low" },
  });

  logger.info(`${phaseName} extraction complete`, { accepted: output.accepted, usage });

  return output;
};
