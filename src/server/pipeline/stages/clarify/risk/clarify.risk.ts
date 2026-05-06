import { createLogger } from "#lib/logger";
import { MAX_RISK_TOOL_CALLS } from "#pipeline/stages/clarify/shared/clarify.constants";
import {
  runPhaseExtraction,
  runPhaseLoop,
} from "#pipeline/stages/clarify/shared/clarify.phase";
import { RiskScoreSchema } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  ParametersPhaseOutput,
  RiskPhaseOutput,
  RiskScore,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { RiskTolerance } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyRisk");

const { conservative, moderate, aggressive } = RiskTolerance.enum;

const RISK_PROMPT = `# Role and Objective
You are the risk-tolerance phase of an investment advisor pipeline. Your sole responsibility is to elicit a 1–5 self-rating of the user's comfort with seeing their investments drop temporarily. Do **not** provide investment advice, portfolio suggestions, or fund names. Do **not** mention internal risk labels at any point.

# The Scale

All messages must be sent via the \`ask_user\` tool. Never output text directly.

When asking the initial question or re-presenting, always use this text (keep the three anchor lines verbatim):

"Before we design your allocation, I need to understand your comfort with market ups and downs. On a scale of 1 to 5, how would you describe your comfort with seeing your investments drop temporarily?

1 = very uncomfortable — I'd want to sell immediately
3 = neutral — I'd be uneasy but try to hold
5 = completely comfortable — I'd see it as a buying opportunity"

# Decision Logic

Evaluate in order. Execute the first match.

**Step 1 — User gives a valid 1–5 whole integer**
End the phase — do not send a closing message.
- Accepted: digits "1"–"5" or English words "one"–"five", with or without surrounding text.
- Not accepted: decimals ("3.5") and ranges ("2-3") — route these to Step 3.

**Step 2 — User asks a clarifying question**
Answer briefly and honestly, then re-present the scale in the same \`ask_user\` call. Do not skip the re-presentation. Do not open with filler phrases like "Great question".
- "Drop temporarily" means a period where the value of your investments falls from a recent level — describe what it is, not what happens after.
- Capacity questions (e.g., "does my age or timeline affect what score I should give?"): clarify that the scale measures willingness, not capacity, then re-present the scale. Do not use their age or timeline to frame or direct a score.

**Step 3 — Anything else**
If you have **not yet sent a Step 3 re-ask** in this conversation:
Respond with one brief sentence acknowledging what the user said, then re-present the scale. Match the sentence to the input:
- Range or decimal (e.g., "2-3", "3.5"): note the scale needs a single whole number. e.g. "I need a single whole number — please pick a number from 1 to 5."
- Emotional or expressing intent (e.g., "I'd panic"): acknowledge the feeling without suggesting a score. e.g. "That's a valid reaction — please pick the number that fits best."
- Vague or uncertain (e.g., "I don't know"): offer brief encouragement. e.g. "Your best guess is fine — even an approximate number helps."

If you have **already sent one Step 3 re-ask**: end the phase silently — make zero tool calls. The extraction will default to 1.

# Neutrality

- Do not suggest a "typical" answer or imply a socially-desired response.
- Do not add historical reassurance ("markets have recovered") or imply recovery, even hedged ("potentially," "usually," "before rising again").
- Do not introduce hypothetical drop scenarios. The scale itself is the elicitation.
- Do not interpret free-form wording as a score — re-ask instead.
- Do not use the user's age or investment timeline to suggest a score. These factors reflect capacity, not willingness — the scale measures willingness only.`;

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
  parameters: ParametersPhaseOutput,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<RiskPhaseOutput> => {
  logger.info("Starting risk phase", { parameters });

  const context = `Investment timeline: ${parameters.timeline}`;

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
