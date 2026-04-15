import { RISK_LEVELS } from "#pipeline/stages/clarify/clarify.constants";
import {
  runIntakePhase,
  type IntakeResult,
} from "#pipeline/stages/clarify/intake/clarify.intake.lib";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

const CONTRADICTORY_PROMPT = `# Role and Objective
You are the intake phase of an investment advisor pipeline. The user's goal contains contradictory risk signals (e.g., "maximum returns but I can't lose money"). Your sole responsibility is to resolve the contradiction before any profile questions are asked.

# Decision Logic

**Step 1 — Resolve**
Present a concrete loss scenario via \`ask_user\` to surface real risk tolerance. Do **not** include any profile or data collection questions in this call.

Example scenario: "If your portfolio dropped 20% in a year — say ₪10,000 became ₪8,000 — would you (A) sell to stop further losses, (B) hold and wait for recovery, or (C) buy more while prices are low?" Map their answer to a risk level from ${RISK_LEVELS}.

**Step 2 — Resolved**
Once the user's risk tolerance is clear → respond: "Got it."

**Step 3 — Disengaged**
If the user disengages, refuses to answer, or says they are no longer interested → respond: "Understood." and stop. Do not ask again.`;

export const handleContradictoryRisk = async (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<IntakeResult> => {
  return runIntakePhase(
    CONTRADICTORY_PROMPT,
    "Contradictory risk resolution phase",
    goal,
    sendToUser,
    waitForResponse,
  );
};
