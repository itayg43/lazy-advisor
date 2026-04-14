import { createLogger } from "#lib/logger";
import { MAX_INTAKE_TOOL_CALLS } from "#pipeline/stages/clarify/clarify.constants";
import { runPhaseLoop } from "#pipeline/stages/clarify/clarify.lib";
import {
  extractAcceptance,
  type IntakeResult,
} from "#pipeline/stages/clarify/intake/clarify.intake.lib";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

const logger = createLogger("clarifyOutOfScope");

const OUT_OF_SCOPE_PROMPT = `# Role and Objective
You are the intake phase of an investment advisor pipeline. The user's goal is out of scope — they asked about individual stock picking, day trading, or direct crypto purchases. Your sole responsibility is to redirect the user toward ETF-based passive investing and get their acceptance before any profile questions are asked.

# Decision Logic

**Step 1 — Redirect**
Deliver the redirect explanation via \`ask_user\`. Do **not** include any profile or data collection questions in this call.

Explain: buying a single stock concentrates all risk in one company — if it drops 40% or faces a major setback, the whole investment suffers; a diversified ETF spreads that risk across hundreds of companies. If the user has a sector preference (e.g., tech), offer a sector ETF as a middle ground. End with a question asking if they'd like to proceed with an ETF plan.

**Step 2 — Accepted**
Once the user accepts (agrees to ETFs, provides their details, or otherwise moves forward) → respond: "Got it."

**Step 3 — Rejected**
If the user explicitly refuses to switch to ETFs or insists on their original out-of-scope request → respond: "Understood." and stop. Do not ask again.`;

export const handleOutOfScopeRedirect = async (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<IntakeResult> => {
  logger.info("Starting out-of-scope redirect phase");

  const responseId = await runPhaseLoop(
    OUT_OF_SCOPE_PROMPT,
    { input: goal },
    MAX_INTAKE_TOOL_CALLS,
    "Out-of-scope redirect phase",
    sendToUser,
    waitForResponse,
  );

  const accepted = await extractAcceptance(responseId);

  return accepted ? { accepted: true, responseId } : { accepted: false };
};
