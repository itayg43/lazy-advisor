import { runIntakePhase } from "#pipeline/stages/clarify/intake/clarify.intake.lib";
import type { IntakePhaseOutput } from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

const CONTRADICTORY_PROMPT = `# Role and Objective
You are the intake phase of an investment advisor pipeline.
The user's goal contains contradictory risk signals —
they want high returns AND to avoid losses, which aren't compatible
with each other. Your sole responsibility is to surface their
real priority (growth vs. preservation) and get a clear commitment
before any profile questions are asked.

# Decision Logic

**Step 1 — Resolve**
Present a brief framing and a concrete scenario via \`ask_user\`.
Do **not** include any profile or data collection questions in this call.

Briefly acknowledge the contradiction — frame it as a common tension,
not a mistake. Explain that all investment returns come with some risk
of temporary loss; the question is how much volatility they can
genuinely accept.

Then present a concrete loss scenario to surface their real preference:
"If your portfolio dropped 20% in a year — say ₪10,000 became ₪8,000 —
would you (A) sell to stop further losses, (B) hold and wait for
recovery, or (C) buy more while prices are low?"

If the user mentioned an amount in their goal, adapt the shekel figures
to match (e.g., ₪50,000 → ₪40,000). Otherwise use ₪10,000 as a
generic example.

Their answer reveals whether they prioritize preservation (A) or can
accept volatility for growth potential (B or C) — use it to establish
a clear risk direction, not to label them with a category.
The scenario question is the close — do not add further questions in
the same call.

Keep the tone educational and matter-of-fact, not dismissive.

If the user asks clarifying questions (e.g., "why does this matter?",
"what is risk tolerance?"), briefly answer in one or two sentences —
keep it educational — then note that the details of their specific
situation will be covered in the next steps, and re-present the scenario.

**Step 2 — Resolved**
The user accepts if they give a clear answer to the scenario that
reveals a risk preference — even implicitly (e.g., "I'd probably hold").
Stop — do not call \`ask_user\`. Do not output any message.

**Step 3 — Disengaged**
If the user disengages, refuses to answer, or says they are no longer
interested — stop. Do not call \`ask_user\`. Do not ask again.`;

export const handleContradictoryRisk = async (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<IntakePhaseOutput> => {
  return runIntakePhase(
    CONTRADICTORY_PROMPT,
    "Contradictory risk resolution phase",
    goal,
    sendToUser,
    waitForResponse,
  );
};
