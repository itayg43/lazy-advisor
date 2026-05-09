import { z } from "zod";

import { MAX_AMOUNT } from "#constants/validation.constants";
import { createLogger } from "#lib/logger";
import {
  AskWithClassifyBaseSchema,
  ConvergenceFailedError,
  askWithClassify,
} from "#pipeline/stages/clarify/shared/clarify.ask";
import {
  TIMELINE_BOUNDARY_EXAMPLES,
  TIMELINE_BUCKET_LIST,
  TIMELINE_BUCKETS,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import type { ParametersPhaseResult } from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { TimelineBucket } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyParameters");

const AmountClassifySchema = AskWithClassifyBaseSchema.extend({
  amount: z.number().int().positive().max(MAX_AMOUNT).nullable(),
});

const TimelineClassifySchema = AskWithClassifyBaseSchema.extend({
  timeline: TimelineBucket.nullable(),
});

export type AmountClassify = z.infer<typeof AmountClassifySchema>;
export type TimelineClassify = z.infer<typeof TimelineClassifySchema>;

const AMOUNT_QUESTION = "How much do you want to invest?";

const TIMELINE_QUESTION = `What's your investment timeline — ${TIMELINE_BUCKETS}?`;

const AMOUNT_CLASSIFY_INSTRUCTIONS = `# Role and Objective
You are classifying a user's response to: "${AMOUNT_QUESTION}"
Populate the three output fields based on the rules below.

# Output Rules

**amount**
- Set to the exact integer in shekels when the user provides a specific number. Convert shorthand (e.g., "₪50k" → 50000, "30 thousand" → 30000).
- Set to null when clarificationNeeded is true.

**clarificationNeeded**
- true — user gave a vague or non-specific answer (e.g., "some money", "a lot", "not sure", "I don't know")
- true — user gave a non-numeric answer
- true — user asked a question instead of answering (e.g., "why do you need to know?")
- true — user deflected or went off-topic
- false — user provided a specific numeric amount

**clarificationMessage** (only when clarificationNeeded is true)
- Must be non-null when clarificationNeeded is true.
- If user asked a question: answer it briefly, then ask for a specific amount in shekels.
- If user gave a vague answer: ask for a specific number in shekels. Do not add encouraging phrases like "even a rough number helps" — a specific number is required.
- If user deflected: redirect back to the question.
- Keep it to 1–2 sentences. Do not re-state the original question.

# Examples

User: "I'm not sure yet"
→ clarificationNeeded: true — ask for a specific number (e.g. "Could you give me a specific amount in shekels?")
User: "some money"
→ clarificationNeeded: true — ask for a specific number (e.g. "Could you give me a specific amount in shekels?")
User: "why do you need to know?"
→ clarificationNeeded: true — answer briefly then ask (e.g. "I need the amount to build your investment plan — could you share a specific number in shekels?")
User: "₪50,000"
→ clarificationNeeded: false — specific amount provided`;

const TIMELINE_CLASSIFY_INSTRUCTIONS = `# Role and Objective
You are classifying a user's response to: "${TIMELINE_QUESTION}"
Populate the three output fields based on the rules below.

# Output Rules

**timeline**
Map the user's stated timeframe to the nearest of these four values: ${TIMELINE_BUCKETS}.
Boundary rule — when a number lands exactly on a boundary, pick the shorter bucket: ${TIMELINE_BOUNDARY_EXAMPLES}.
Any timeframe strictly over 10 years maps to "10+ years".
Set to null when clarificationNeeded is true.

**clarificationNeeded**
- true — user gave a genuinely vague answer (e.g., "long-term", "a while", "someday", "I don't know")
- true — user asked a question instead of answering
- true — user deflected or went off-topic
- false — user stated any specific timeframe or number of years (even approximate, e.g., "around 10 years or more")

**clarificationMessage** (only when clarificationNeeded is true)
- Must be non-null when clarificationNeeded is true.
- If user asked a question: answer it briefly, then ask for their timeline.
- If user gave a vague answer: ask them to pick from the four options:
${TIMELINE_BUCKET_LIST}
- If user deflected: redirect back to the question.
- Keep it to 1–2 sentences. Do not re-state the original question.

# Examples

User: "long-term"
→ clarificationNeeded: true — ask to pick from four options (e.g. "Could you pick one of these: under 3 years, 3–5 years, 5–10 years, or 10+ years?")
User: "5 years"
→ clarificationNeeded: false — maps to "3–5 years" (boundary: shorter bucket wins)
User: "10 years"
→ clarificationNeeded: false — maps to "5–10 years" (boundary: shorter bucket; "10+ years" requires strictly more than 10)
User: "around 10 years or maybe more"
→ clarificationNeeded: false — approximate is specific enough, maps to "10+ years"
User: "why does this matter?"
→ clarificationNeeded: true — answer briefly then ask (e.g. "Your timeline determines how much risk your portfolio can absorb — could you share roughly how many years you plan to invest?")
User: "skip"
→ clarificationNeeded: true — redirect directly, no softening (e.g. "I need your timeline to continue — could you pick one: under 3 years, 3–5 years, 5–10 years, or 10+ years?")`;

const askAmount = async (
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<number | null> => {
  try {
    const output = await askWithClassify({
      question: AMOUNT_QUESTION,
      classifyInstructions: AMOUNT_CLASSIFY_INSTRUCTIONS,
      schema: AmountClassifySchema,
      sendToUser,
      waitForResponse,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 1,
    });

    if (output.amount === null) {
      logger.warn("askAmount — null after convergence");
    }

    return output.amount;
  } catch (error) {
    if (error instanceof ConvergenceFailedError) {
      logger.error("askAmount — follow-ups exhausted", error);

      return null;
    }

    throw error;
  }
};

const askTimeline = async (
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<z.infer<typeof TimelineBucket> | null> => {
  try {
    const output = await askWithClassify({
      question: TIMELINE_QUESTION,
      classifyInstructions: TIMELINE_CLASSIFY_INSTRUCTIONS,
      schema: TimelineClassifySchema,
      sendToUser,
      waitForResponse,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 1,
    });

    if (output.timeline === null) {
      logger.warn("askTimeline — null after convergence");
    }

    return output.timeline;
  } catch (error) {
    if (error instanceof ConvergenceFailedError) {
      logger.error("askTimeline — follow-ups exhausted", error);

      return null;
    }

    throw error;
  }
};

export const collectParameters = async (
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<ParametersPhaseResult> => {
  logger.info("Starting parameters phase");

  const amount = await askAmount(sendToUser, waitForResponse);
  if (amount === null) return { status: "failure", reason: "amount_missing" };

  const timeline = await askTimeline(sendToUser, waitForResponse);
  if (timeline === null) return { status: "failure", reason: "timeline_missing" };

  return { status: "success", parameters: { amount, timeline } };
};
