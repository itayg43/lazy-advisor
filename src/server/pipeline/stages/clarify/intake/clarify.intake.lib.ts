import { createLogger } from "#lib/logger";
import { MAX_INTAKE_TOOL_CALLS } from "#pipeline/stages/clarify/clarify.constants";
import { runPhaseLoop } from "#pipeline/stages/clarify/clarify.lib";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

const logger = createLogger("clarifyIntake");

export type IntakeResult = { accepted: true; responseId: string } | { accepted: false };

// Determines acceptance from the model's terminal phrase: "Got it." → accepted, "Understood." → rejected.
// The terminal phrase is the classification signal — no separate API call is needed.
// The prompts instruct the model to output exactly these phrases, and evals enforce that contract.
const extractAcceptanceFromText = (terminalText: string): boolean =>
  /^\s*got it[.!]?\s*$/i.test(terminalText);

// Runs the tool-call loop for an intake phase and interprets the terminal phrase as an IntakeResult.
export const runIntakePhase = async (
  instructions: string,
  phaseName: string,
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<IntakeResult> => {
  logger.info(`Starting ${phaseName}`);

  const { responseId, terminalText } = await runPhaseLoop(
    instructions,
    { input: goal },
    MAX_INTAKE_TOOL_CALLS,
    phaseName,
    sendToUser,
    waitForResponse,
  );

  const accepted = extractAcceptanceFromText(terminalText);
  logger.info(`${phaseName} complete`, { accepted });

  return accepted ? { accepted: true, responseId } : { accepted: false };
};
