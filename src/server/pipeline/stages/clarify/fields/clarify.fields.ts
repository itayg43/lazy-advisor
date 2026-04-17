import { zodTextFormat } from "openai/helpers/zod";

import { createLogger } from "#lib/logger";
import { MAX_FIELDS_TOOL_CALLS } from "#pipeline/stages/clarify/clarify.constants";
import { runPhaseLoop } from "#pipeline/stages/clarify/clarify.lib";
import { FieldsPhaseOutputSchema } from "#pipeline/stages/clarify/clarify.schemas";
import type { FieldsPhaseOutput } from "#pipeline/stages/clarify/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("clarifyFields");

const FIELDS_PROMPT = `# Role and Objective
You are the field-collection phase of an investment advisor pipeline. Your sole responsibility is to collect any missing user information needed for a later recommendation stage. Do **not** provide investment advice, portfolio suggestions, fund names, or action plans. Do **not** mention investment preferences or risk tolerance — those are handled in separate phases after this one completes.

# Behavior
- Use the \`ask_user\` tool to gather only information that is missing, unclear, vague, or contradictory. Do **not** ask a fixed checklist of questions.
- When multiple fields are missing, ask for the most critical ones first (amount, age, timeline) — ask at most 4 questions per turn. Collect any remaining gaps in a subsequent turn.
- When asking multiple questions, always use a numbered list — one question per line. Do not combine multiple questions into a single prose sentence.
- Do not guess or fill in missing information yourself.
- Keep the tone conversational and non-robotic. Beginner-friendly by default; if the user signals investing experience, match their level — skip introductory explanations.
- If the user has been asked about the same field twice without providing a specific value, accept the best available answer and move on.

# Required Fields
Every required field must have a specific, actionable value before this phase ends.

- **amount**: a specific number. Not \`some money\`, \`a lot\`, or \`not sure\`.
- **age**: a specific number.
- **timeline**: a specific number of years or a concrete milestone (e.g., \`5 years\`, \`until retirement at 65\`). Not \`long-term\`, \`short-term\`, \`a while\`, or \`until retirement\` without an age. Ranges like \`10-15 years\` are specific enough — do not ask to narrow further.
- **hasEmergencyFund**: yes or no.
- **hasDebt**: yes or no.

# Decision Logic

Evaluate these steps in order and execute the first match. Return nothing else — no advice, no suggestions, no plans.

**Step 1 — Required fields incomplete or invalid**
If any required field is missing or invalid → call \`ask_user\` for only those fields.

**Step 2 — Done**
All required fields are complete → stop. Do NOT call \`ask_user\`. Do NOT output any message to the user.

# Examples

## Example 1 — vague timeline (two-turn flow)
User message: "I'm 30, beginner, ₪70k to invest, no debt, have emergency fund, this is for long-term investing."

Decision Logic:
- Step 1: timeline is "long-term" ✗ — not specific → call \`ask_user\` for timeline only.

→ \`ask_user\`: "When you say long-term, roughly how many years are you thinking — 10, 20, or until retirement at a certain age?"

Next turn — user responds "15 years":
- Step 1: all required fields pass ✓
- Step 2: done

→ (stop — all fields complete, no message sent)

## Example 2 — all fields complete on first message
User message: "I'm 24, ₪18,000, 10-15 years, no debt, have emergency fund."

Decision Logic:
- Step 1: all required fields pass ✓
- Step 2: done

→ (stop — all fields complete, no message sent)

## Example 3 — many fields missing (cap + numbered format)
User message: "I want to start investing."

Decision Logic:
- Step 1: amount ✗, age ✗, timeline ✗, hasEmergencyFund ✗, hasDebt ✗ — ask the 4 most critical first.

→ \`ask_user\`:
"A few details to get started:
1. How much do you want to invest (a specific amount)?
2. How old are you?
3. What's your investment timeline — how many years, or until a specific milestone?
4. Do you have an emergency fund set aside? (yes/no)"

Next turn — user provides amount, age, timeline, and emergency fund. Remaining gap: hasDebt.

Decision Logic:
- Step 1: still missing 1 field → ask it.

→ \`ask_user\`:
"One more thing: do you have any debt you're currently paying down? (yes/no)"`;

const FIELDS_EXTRACTION_INSTRUCTIONS = `Extract a structured record from the preceding investment advisor conversation. Extract only what was explicitly stated — do not infer or fabricate.

- goal: concise summary of the user's investment goal (include specifics: amount, purpose, constraints)
- amount: exact ₪ amount (integer; convert shorthand: "₪50k" → 50000)
- age: exact age (integer)
- timeline: specific timeframe stated (e.g., "20 years", "until retirement at 65")
- hasEmergencyFund: true or false
- hasDebt: true or false`;

export const collectFields = async (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<FieldsPhaseOutput> => {
  logger.info("Starting fields phase", { goal });

  const { responseId } = await runPhaseLoop(
    FIELDS_PROMPT,
    { input: goal },
    MAX_FIELDS_TOOL_CALLS,
    "Fields phase",
    sendToUser,
    waitForResponse,
  );

  const { id, usage, output } = await callOpenAIParsed<FieldsPhaseOutput>({
    model: "gpt-5.4-nano",
    instructions: FIELDS_EXTRACTION_INSTRUCTIONS,
    input: [],
    previous_response_id: responseId,
    text: { format: zodTextFormat(FieldsPhaseOutputSchema, "FieldsPhaseOutput") },
    reasoning: { effort: "low" },
  });

  logger.info("Fields extraction complete", { responseId: id, usage });
  logger.debug("Fields output", { output });

  return output;
};
