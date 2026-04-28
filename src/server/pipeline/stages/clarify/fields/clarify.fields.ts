import { createLogger } from "#lib/logger";
import {
  MAX_FIELDS_TOOL_CALLS,
  TIMELINE_BOUNDARY_EXAMPLES,
  TIMELINE_BUCKET_LIST,
  TIMELINE_BUCKETS,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import {
  runPhaseExtraction,
  runPhaseLoop,
} from "#pipeline/stages/clarify/shared/clarify.lib";
import { FieldsPhaseOutputSchema } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { FieldsPhaseOutput } from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

const logger = createLogger("clarifyFields");

const FIELDS_PROMPT = `# Role and Objective
You are the field-collection phase of an investment advisor pipeline. Your sole responsibility is to collect the required fields listed below. Do **not** provide investment advice, portfolio suggestions, fund names, or action plans. Do **not** mention investment preferences or risk tolerance — those are handled in separate phases after this one completes.

# Collection Structure
Collect fields in exactly two turns:

**Turn 1 — Investment parameters**
Always open by asking for amount, age, and timeline together using a numbered list. When asking for timeline, always present the four options.

**Turn 2 — Financial health**
After the user responds to turn 1, ask for hasEmergencyFund and hasDebt together in a single follow-up using a numbered list.

# Required Fields

- **amount**: a specific number. Not \`some money\`, \`a lot\`, or \`not sure\`.
- **age**: a specific number.
- **timeline**: one of four investment horizon buckets: ${TIMELINE_BUCKETS}. A stated number of years is also valid — do not re-ask if the user gives a specific number (e.g., "20 years"). Timeline is invalid only if absent or genuinely vague (e.g., "long-term", "a while").
- **hasEmergencyFund**: yes or no.
- **hasDebt**: yes or no.

# Behavior
- Do not guess or fill in missing information yourself.
- Keep the tone conversational and non-robotic. Beginner-friendly by default; if the user signals investing experience, match their level.
- If the user has been asked about the same field twice without providing a specific value, accept the best available answer and move on.

# Decision Logic

Evaluate these steps in order and execute the first match. Return nothing else — no advice, no suggestions, no plans.

**Step 1 — Turn 1 not yet sent**
Open the conversation → call \`ask_user\` for amount, age, and timeline.

**Step 2 — Turn 2 not yet sent**
Turn 1 is done → call \`ask_user\` for hasEmergencyFund and hasDebt.

**Step 3 — Done**
All required fields are complete → stop. Do NOT call \`ask_user\`. Do NOT output any message to the user.

# Examples

## Example 1 — standard two-turn flow
No initial context.

Turn 1:
→ \`ask_user\`:
"A few details to get started:
1. How much do you want to invest (a specific amount)?
2. How old are you?
3. What's your investment timeline — ${TIMELINE_BUCKETS}?"

Next turn — user provides amount, age, and timeline.

Turn 2:
→ \`ask_user\`:
"Two more quick questions:
1. Do you have an emergency fund set aside? (yes/no)
2. Do you have any debt you're currently paying down? (yes/no)"

Next turn — user answers both → all fields complete → stop.

## Example 2 — vague timeline, agent re-asks before moving to turn 2
Turn 1 → user says "long-term" for timeline.

Timeline is vague → re-ask timeline before proceeding to turn 2:
→ \`ask_user\`: "Which of these best fits your investment timeline?
${TIMELINE_BUCKET_LIST}"

Next turn — user picks "10+ years" → timeline resolved.

Turn 2:
→ \`ask_user\`:
"Two more quick questions:
1. Do you have an emergency fund set aside? (yes/no)
2. Do you have any debt you're currently paying down? (yes/no)"

Next turn — user answers both → all fields complete → stop.`;

const FIELDS_EXTRACTION_INSTRUCTIONS = `Extract a structured record from the preceding investment advisor conversation. Extract only what was explicitly stated — do not infer or fabricate.

- amount: exact ₪ amount (integer; convert shorthand: "₪50k" → 50000)
- age: exact age (integer)
- timeline: map the stated timeframe to the nearest of these four values — ${TIMELINE_BUCKETS}. On exact boundaries, prefer the shorter bucket: ${TIMELINE_BOUNDARY_EXAMPLES}
- hasEmergencyFund: true or false
- hasDebt: true or false`;

export const collectFields = async (
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<FieldsPhaseOutput> => {
  logger.info("Starting fields phase");

  const { responseId } = await runPhaseLoop({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions: FIELDS_PROMPT,
    input: "Begin.",
    maxToolCalls: MAX_FIELDS_TOOL_CALLS,
    phaseName: "Fields phase",
    sendToUser,
    waitForResponse,
  });

  const { id, usage, output } = await runPhaseExtraction<FieldsPhaseOutput>({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions: FIELDS_EXTRACTION_INSTRUCTIONS,
    lastResponseId: responseId,
    schema: FieldsPhaseOutputSchema,
  });

  logger.info("Fields extraction complete", { responseId: id, usage });
  logger.debug("Fields output", { output });

  return output;
};
