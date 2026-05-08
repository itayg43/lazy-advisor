import { createLogger } from "#lib/logger";
import {
  MAX_PARAMETERS_TOOL_CALLS,
  TIMELINE_BOUNDARY_EXAMPLES,
  TIMELINE_BUCKET_LIST,
  TIMELINE_BUCKETS,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import {
  runPhaseExtraction,
  runPhaseLoop,
} from "#pipeline/stages/clarify/shared/clarify.phase";
import { ParametersExtractionSchema } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  ParametersExtraction,
  ParametersPhaseResult,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

const logger = createLogger("clarifyParameters");

const PARAMETERS_PROMPT = `# Role and Objective
You are the parameter-collection phase of an investment advisor pipeline. Collect the two required parameters below through separate questions. Do not provide investment advice, portfolio suggestions, fund names, or action plans. Do not mention risk tolerance — that is handled in a separate phase.

# Required Parameters

- **amount**: a specific integer in shekels. Vague phrases (e.g., \`some money\`, \`a lot\`, \`not sure\`) are not valid.
- **timeline**: one of four investment horizon buckets: ${TIMELINE_BUCKETS}. A stated number of years is also valid (e.g., "20 years"). Timeline is invalid only if absent or genuinely vague (e.g., "long-term", "a while").

# Behavior
- Ask one parameter per turn.
- Do not guess or fill in missing information yourself.
- Keep the tone conversational and non-robotic. Beginner-friendly by default.
- **Two-try rule:** If a parameter has been asked twice without a valid answer:
  - Amount: end the phase — do not ask for timeline.
  - Timeline: end the phase — do not ask further.

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
If still vague or no specific timeframe → end phase. Do NOT call \`ask_user\` again.

**Step 5 — All parameters collected**
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

## Example 3 — vague first attempt, valid second attempt → success
→ \`ask_user\` for amount. User: "₪30,000".
→ \`ask_user\` for timeline. User: "long-term".
→ Re-ask timeline. User: "somewhere around 10 years or more".
Second attempt is specific enough to map → "10+ years" → stop.

## Example 4 — amount never provided
→ \`ask_user\`: "How much do you want to invest?"
User: "I'm not sure yet"

→ \`ask_user\`: "Could you give me a specific amount in shekels?"
User: "I really don't know"

Amount asked twice with no specific number → end phase. Do NOT ask for timeline.

## Example 5 — timeline never resolved
→ \`ask_user\` for amount. User: "₪40,000".
→ \`ask_user\` for timeline. User: "I don't know, maybe someday".
→ Re-ask timeline:
"Which of these best fits your investment timeline?
${TIMELINE_BUCKET_LIST}"
User: "I really can't say"
Timeline asked twice with no specific timeframe → end phase. Do NOT call \`ask_user\` again.`;

const PARAMETERS_EXTRACTION_INSTRUCTIONS = `Extract from the preceding investment advisor conversation.

- amount: the exact investment amount as an integer (convert shorthand: "₪50k" → 50000). Set to null if the user never provided a specific number after being asked twice.
- timeline: map the stated timeframe to the nearest of these four values — ${TIMELINE_BUCKETS}. On exact boundaries, prefer the shorter bucket: ${TIMELINE_BOUNDARY_EXAMPLES}. Set to null if the user never provided a specific timeframe or number of years after being asked twice (e.g., both responses were genuinely vague like "I don't know" or "someday").`;

export const collectParameters = async (
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<ParametersPhaseResult> => {
  logger.info("Starting parameters phase");

  const { responseId } = await runPhaseLoop({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions: PARAMETERS_PROMPT,
    input: "Begin.",
    maxToolCalls: MAX_PARAMETERS_TOOL_CALLS,
    phaseName: "Parameters phase",
    sendToUser,
    waitForResponse,
  });

  const { id, usage, output } = await runPhaseExtraction<ParametersExtraction>({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions: PARAMETERS_EXTRACTION_INSTRUCTIONS,
    lastResponseId: responseId,
    schema: ParametersExtractionSchema,
  });

  logger.info("Parameters extraction complete", { responseId: id, usage });
  logger.debug("Parameters output", { output });

  if (output.amount === null) {
    logger.info("Parameters phase failed — amount missing");

    return { status: "failure", code: "amount_missing" };
  }

  if (output.timeline === null) {
    logger.info("Parameters phase failed — timeline missing");

    return { status: "failure", code: "timeline_missing" };
  }

  return {
    status: "success",
    parameters: { amount: output.amount, timeline: output.timeline },
  };
};
