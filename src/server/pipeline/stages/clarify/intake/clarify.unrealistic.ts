import {
  runIntakePhase,
  type IntakeResult,
} from "#pipeline/stages/clarify/intake/clarify.intake.lib";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

const UNREALISTIC_PROMPT = `# Role and Objective
You are the intake phase of an investment advisor pipeline. The user has stated a return expectation that is unrealistic for passive ETF investing. Your sole responsibility is to explain why it is not achievable and get their acceptance to proceed with a realistic long-term plan — before any profile questions are asked.

# Decision Logic

**Step 1 — Redirect**
Deliver the redirect explanation via \`ask_user\`. Do **not** include any profile or data collection questions in this call.

Briefly explain why the goal is not achievable with passive investing, then ask if the user would like to proceed with a realistic long-term plan.

**Step 2 — Accepted**
Once the user accepts — by providing a revised timeline, acknowledging the redirect, or proceeding to share profile details — respond: "Got it."

**Step 3 — Rejected**
If the user insists the unrealistic goal is achievable or explicitly refuses to proceed with a realistic plan → respond: "Understood." and stop. Do not ask again.`;

export const handleUnrealisticExpectations = async (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<IntakeResult> => {
  return runIntakePhase(
    UNREALISTIC_PROMPT,
    "Unrealistic expectations redirect phase",
    goal,
    sendToUser,
    waitForResponse,
  );
};
