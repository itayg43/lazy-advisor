import { runIntakePhase } from "#pipeline/stages/clarify/intake/clarify.intake.lib";
import type { IntakePhaseOutput } from "#pipeline/stages/clarify/shared/clarify.types";
import type { Responder } from "#pipeline/tools/ask-user.tool";

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
"what is risk tolerance?"), call \`ask_user\` again with a brief answer
(one or two sentences) — keep it educational — note that the details
of their specific situation will be covered in the next steps, and
re-present the scenario.

**Step 2 — Resolved**
The user accepts if they give any answer that reveals a lean toward
sell, hold, or buy more — even with hesitation, uncertainty, or the
word "probably" or "I think" (e.g., "I'd probably hold", "I'd probably
hold but I'm not sure", "I think I'd sell"). Any lean toward an option
counts, even when combined with expressed doubt. Stop — do not call
\`ask_user\`. Do not output any message.

**Step 3 — Disengaged**
If the user disengages, refuses to answer, or says they are no longer
interested — stop. Do not call \`ask_user\`. Do not ask again.`;

const CONTRADICTORY_EXTRACTION_INSTRUCTIONS = `Based on the preceding intake conversation, determine whether the user resolved the contradiction.

Set accepted to true if the user gave any answer to the A/B/C scenario question that reveals a risk preference — even with hesitation or reluctance (e.g., "I'd feel sick but I'd hold", "I guess I'd hold", "I'd probably sell"). Any clear response to the scenario (sell / hold / buy more) counts.

Set accepted to false only if the user disengaged, said they are no longer interested, or refused to engage entirely.`;

export const handleContradictoryRisk = async (
  goal: string,
  responder: Responder,
): Promise<IntakePhaseOutput> => {
  return runIntakePhase(
    CONTRADICTORY_PROMPT,
    "Contradictory risk resolution phase",
    goal,
    responder,
    CONTRADICTORY_EXTRACTION_INSTRUCTIONS,
  );
};
