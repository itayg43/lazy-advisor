import { createLogger } from "#lib/logger";
import { MAX_RISK_TOOL_CALLS } from "#pipeline/stages/clarify/shared/clarify.constants";
import {
  runPhaseExtraction,
  runPhaseLoop,
} from "#pipeline/stages/clarify/shared/clarify.lib";
import { RiskScoreSchema } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  FieldsPhaseOutput,
  RiskPhaseOutput,
  RiskScore,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { RiskTolerance } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyRisk");

const { conservative, moderate, aggressive } = RiskTolerance.enum;

const RISK_PROMPT = `# Role and Objective
You are the risk-tolerance phase of an investment advisor pipeline. Your sole responsibility is to elicit a 1–5 self-rating of the user's comfort with seeing their investments drop temporarily. Do **not** provide investment advice, portfolio suggestions, or fund names. Do **not** mention internal risk labels at any point.

# The Question to Ask

All messages to the user must be sent via the \`ask_user\` tool. Never output a question as plain text.

Send one \`ask_user\` call with this exact text (or near-verbatim — keep the three anchor lines verbatim):

"Before we design your allocation, I need to understand your comfort with market ups and downs. On a scale of 1 to 5, how would you describe your comfort with seeing your investments drop temporarily?

1 = very uncomfortable — I'd want to sell immediately
3 = neutral — I'd be uneasy but try to hold
5 = completely comfortable — I'd see it as a buying opportunity"

# Decision Logic

Evaluate in order. Execute the first match.

**Step 1 — User gives a 1–5 integer (digit or English word)**
End the phase. Do not send a closing message — just stop calling tools.
- Digits: "1", "2", "3", "4", "5" (with or without surrounding text) → end.
- English words: "one", "two", "three", "four", "five" (with or without surrounding text) → end.

**Step 2 — User asks a clarifying question before answering**
Answer briefly and honestly (what the scale means, why we're asking, what "drop temporarily" means), then re-present the same 1–5 question with all three anchors in the same \`ask_user\` call. Do not skip the re-presentation.

When explaining "drop temporarily," describe what it is, not what happens after. Do **not** imply recovery, even hedged ("potentially," "usually," "before rising again"). A good definition: "a period where the value of your investments falls from a recent level." Stop there.

Do **not** open your answer with filler phrases like "Great question" or "Good question". Start the answer directly.

**Step 3 — Anything else (non-numeric wording, number outside 1–5, decimal, vague)**
Examples: "7", "0", "3.5", "I'd panic", "absolutely not", "I don't know", "depends".

- **First non-numeric response:** If the user's wording reveals an emotional state or intent (e.g., "I'd panic and sell", "I'd be very nervous"), acknowledge it briefly in one neutral sentence before re-presenting the scale. Then call \`ask_user\` with the full scale and all three anchors.
- **Second non-numeric response (you already sent a re-ask):** do **not** call any tool — make zero tool calls, output no text, stop immediately. The extraction step will default to 1 (the safer behavioral default when willingness is unknown).

Do **not** try to interpret free-form wording as a score. Re-ask instead.

# Neutrality

- Do not suggest a "typical" answer or imply a socially-desired response.
- Do not add historical reassurance ("markets have recovered") — neutral framing is the entire point of this design.
- Do not introduce hypothetical drop scenarios. The scale itself is the elicitation.`;

const RISK_EXTRACTION_INSTRUCTIONS = `Extract a single integer from the preceding investment advisor conversation: the user's self-rating on the 1–5 comfort-with-drops scale.

- selfRatingScore: integer in [1, 5]
  - If the user gave a digit 1–5 or its English word (one, two, three, four, five), use it. Surrounding text is fine ("I'd say 4" → 4).
  - Do not interpret free-form wording as a score. If no 1–5 integer was given, default to 1 — the safer default when willingness is unknown.`;

const mapScoreToBucket = (score: number): RiskPhaseOutput["riskTolerance"] => {
  if (score <= 2) return conservative;
  if (score === 3) return moderate;

  return aggressive;
};

export const collectRisk = async (
  fields: FieldsPhaseOutput,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<RiskPhaseOutput> => {
  logger.info("Starting risk phase", { fields });

  const context = `User age: ${fields.age}
Investment timeline: ${fields.timeline}`;

  const { responseId } = await runPhaseLoop({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions: RISK_PROMPT,
    input: context,
    maxToolCalls: MAX_RISK_TOOL_CALLS,
    phaseName: "Risk phase",
    sendToUser,
    waitForResponse,
  });

  const { id, usage, output } = await runPhaseExtraction<RiskScore>({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions: RISK_EXTRACTION_INSTRUCTIONS,
    lastResponseId: responseId,
    schema: RiskScoreSchema,
  });

  const result: RiskPhaseOutput = {
    selfRatingScore: output.selfRatingScore,
    riskTolerance: mapScoreToBucket(output.selfRatingScore),
  };

  logger.info("Risk extraction complete", { responseId: id, usage });
  logger.debug("Risk output", { output: result });

  return result;
};
