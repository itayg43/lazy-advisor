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
import { FieldsExtractionSchema } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  FieldsExtraction,
  FieldsPhaseResult,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

const logger = createLogger("clarifyFields");

const FIELDS_PROMPT = `# Role and Objective
You are the field-collection phase of an investment advisor pipeline. Collect the two required fields below through separate questions. Do not provide investment advice, portfolio suggestions, fund names, or action plans. Do not mention risk tolerance — that is handled in a separate phase.

# Required Fields

- **amount**: a specific integer in shekels. Vague phrases (e.g., \`some money\`, \`a lot\`, \`not sure\`) are not valid.
- **timeline**: one of four investment horizon buckets: ${TIMELINE_BUCKETS}. A stated number of years is also valid (e.g., "20 years"). Timeline is invalid only if absent or genuinely vague (e.g., "long-term", "a while").

# Behavior
- Ask one field per turn.
- Do not guess or fill in missing information yourself.
- Keep the tone conversational and non-robotic. Beginner-friendly by default.
- **Two-try rule:** If a field has been asked twice without a valid answer:
  - Amount: end the phase — do not ask for timeline.
  - Timeline: accept the best available answer and stop.

# Decision Logic

Evaluate in order and execute the first match. Return nothing else.

**Step 1 — Amount not yet asked**
→ Ask: "How much do you want to invest?"

**Step 2 — Amount asked; no specific number given**
→ Re-ask once: "Could you give me a specific amount in shekels?"
If still no specific number → end phase. Do NOT call \`ask_user\` again.

**Step 3 — Amount collected; timeline not yet asked**
→ Ask: "What's your investment timeline — ${TIMELINE_BUCKETS}?"

**Step 4 — Timeline asked; answer is vague**
→ Re-ask once:
"Which of these best fits your investment timeline?
${TIMELINE_BUCKET_LIST}"
Accept whatever the user says on this second attempt.

**Step 5 — All fields collected**
→ Stop. Do NOT call \`ask_user\`. Do NOT output any message to the user.

# Examples

## Example 1 — standard two-turn flow
→ \`ask_user\`: "How much do you want to invest?"
User: "₪50,000"

→ \`ask_user\`: "What's your investment timeline — ${TIMELINE_BUCKETS}?"
User: "10+ years" → stop.

## Example 2 — vague timeline, agent re-asks
→ \`ask_user\`: "How much do you want to invest?"
User: "₪20,000"

→ \`ask_user\`: "What's your investment timeline — ${TIMELINE_BUCKETS}?"
User: "long-term"

Timeline vague → re-ask:
→ \`ask_user\`: "Which of these best fits your investment timeline?
${TIMELINE_BUCKET_LIST}"
User: "I think 10+ years" → stop.

## Example 3 — vague timeline accepted after second ask
→ \`ask_user\` for amount. User: "₪30,000".
→ \`ask_user\` for timeline. User: "long-term".
→ Re-ask timeline. User: "somewhere around 10 years or more".
Timeline asked twice — accept best available (maps to "10+ years") → stop.

## Example 4 — amount never provided
→ \`ask_user\`: "How much do you want to invest?"
User: "I'm not sure yet"

→ \`ask_user\`: "Could you give me a specific amount in shekels?"
User: "I really don't know"

Amount asked twice with no specific number → end phase. Do NOT ask for timeline.`;

const FIELDS_EXTRACTION_INSTRUCTIONS = `Extract from the preceding investment advisor conversation.

- amount: the exact investment amount as an integer (convert shorthand: "₪50k" → 50000). Set to null if the user never provided a specific number after being asked twice.
- timeline: map the stated timeframe to the nearest of these four values — ${TIMELINE_BUCKETS}. On exact boundaries, prefer the shorter bucket: ${TIMELINE_BOUNDARY_EXAMPLES}`;

export const collectFields = async (
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<FieldsPhaseResult> => {
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

  const { id, usage, output } = await runPhaseExtraction<FieldsExtraction>({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions: FIELDS_EXTRACTION_INSTRUCTIONS,
    lastResponseId: responseId,
    schema: FieldsExtractionSchema,
  });

  logger.info("Fields extraction complete", { responseId: id, usage });
  logger.debug("Fields output", { output });

  if (output.amount === null) {
    return { status: "failure", code: "amount_missing" };
  }

  return {
    status: "success",
    fields: { amount: output.amount, timeline: output.timeline },
  };
};
