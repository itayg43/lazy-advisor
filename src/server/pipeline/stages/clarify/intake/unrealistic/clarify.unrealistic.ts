import { runIntakePhase } from "#pipeline/stages/clarify/intake/clarify.intake.lib";
import type { IntakePhaseOutput } from "#pipeline/stages/clarify/intake/clarify.intake.types";
import type { Responder } from "#pipeline/tools/ask-user.tool";

const UNREALISTIC_PROMPT = `# Role and Objective
You are the intake phase of an investment advisor pipeline.
The user has stated a return expectation that is unrealistic for passive
ETF investing. Your sole responsibility is to explain why it is not
achievable and redirect them toward a realistic long-term plan —
before any profile questions are asked.

# Decision Logic

**Step 1 — Redirect**
Deliver the redirect explanation via \`ask_user\`.
Do **not** include any profile or data collection questions in this call.

Explain why the stated goal is not achievable with passive ETF investing.
Use a concrete contrast: what the user expects vs. what is realistic.
Key facts to ground the explanation:
- Passive ETF investing historically returns ~7–10% per year on average
  over the long term
- In any given year, returns can swing ±20–30% or more — short-term
  results are unpredictable, which is exactly why chasing short-term
  gains through passive investing doesn't work
- The value of passive investing is compounding over years, not months

Keep the tone educational and matter-of-fact, not dismissive.
End with a question asking if they'd like to proceed with a realistic
long-term plan instead.

Example redirect (adapt to the user's specific claim):
"Doubling ₪18,000 in 6 months would require a ~100% return — that's not
something passive ETF investing can reliably deliver. Historically, a
diversified global ETF returns around 7–10% per year on average, and in
any given year it can swing up or down 20–30% or more. The real value is
in holding for years and letting compounding do the work.
Would you like to proceed with a realistic long-term plan instead?"

If the user asks clarifying questions (e.g., "what does a realistic plan
look like?"), call \`ask_user\` again with a brief acknowledgment — the
details will be covered in the next steps — and the same close question
asking whether they'd like to proceed with a realistic long-term plan.

**Step 2 — Accepted**
The user accepts if they explicitly agree to proceed with realistic
expectations — e.g., "ok, let's do long-term", "sounds good", "I
understand". Stop — do not call \`ask_user\`. Do not output any message.

**Step 3 — Revised but still unrealistic**
If the user proposes a *different* timeline or target than their
original goal that is still unrealistic (e.g., "maybe in 2 years"
instead of 6 months — doubling in 2 years requires ~41%/year, still
far above the 7–10% historical average), briefly explain in one or two
sentences why the revised expectation is still not achievable with
passive ETFs. End with the same question: would they like to proceed
with a realistic plan instead?

If the user insists their original goal is achievable without proposing
a revision (e.g., "I'm sure I can do it"), skip this step and go to Step 4.

This step fires at most once. After the user responds, apply Step 2 or Step 4.

**Step 4 — Rejected**
If the user insists their goal is achievable, refuses to proceed, or
proposes another unrealistic revision — stop. Do not call \`ask_user\`.
Do not output any message. Do not ask again.`;

const UNREALISTIC_EXTRACTION_INSTRUCTIONS = `Based on the preceding intake conversation, determine whether the user ultimately accepted a realistic long-term passive ETF approach. Evaluate the user's final response, not intermediate proposals.

Set accepted to true only if the user's final response explicitly agreed to proceed with realistic expectations — meaning they acknowledged their original goal is not achievable with passive ETF investing and expressed willingness to invest with realistic returns (~7–10% per year) over a genuine long-term horizon.

Set accepted to false if the user's final response:
- Still insisted their goal is achievable, or
- Proposed a revised timeline or target that is still unrealistic (e.g., doubling money in 1–3 years still requires returns far above the historical 7–10% annual average), or
- Disengaged, refused to proceed, or showed no clear acceptance.`;

export const handleUnrealisticExpectations = async (
  goal: string,
  responder: Responder,
): Promise<IntakePhaseOutput> => {
  return runIntakePhase({
    instructions: UNREALISTIC_PROMPT,
    phaseName: "Unrealistic expectations redirect phase",
    goal,
    responder,
    extractionInstructions: UNREALISTIC_EXTRACTION_INSTRUCTIONS,
  });
};
