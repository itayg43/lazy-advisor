import { createLogger } from "#lib/logger";
import { MAX_INTAKE_TOOL_CALLS } from "#pipeline/stages/clarify/shared/clarify.constants";
import { runPhaseLoop } from "#pipeline/stages/clarify/shared/clarify.lib";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

const logger = createLogger("clarifyIntake");

// responseId: the final OpenAI response ID from the intake loop. Carried for Phase 7d,
// which will make a post-acceptance extraction call against it to produce redirectedGoal.
// Not consumed by the orchestrator directly.
//
// redirectedGoal: clean goal string produced by Phase 7d after the user accepts an ETF
// redirect. When present, the orchestrator passes it to all downstream phases instead of
// the original raw goal. Absent until Phase 7d lands — orchestrator falls back to goal.
export type IntakeResult =
  | { accepted: true; responseId: string; redirectedGoal?: string }
  | { accepted: false };

export type IntakeHandler = (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
) => Promise<IntakeResult>;

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
