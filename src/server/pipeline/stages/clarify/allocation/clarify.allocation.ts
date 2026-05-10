import { createLogger } from "#lib/logger";
import {
  ALLOCATION_ANCHOR_TABLE,
  ALLOCATION_TIMELINE_BUCKETS,
  MAX_ALLOCATION_TOOL_CALLS,
  RISK_LEVELS,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import {
  PhaseLoopToolCallsExhaustedError,
  runPhaseExtraction,
  runPhaseLoop,
} from "#pipeline/stages/clarify/shared/clarify.phase";
import {
  AllocationPhaseOutputSchema,
  ClarifyUnresolvedReasonEnum,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  AllocationPhaseOutput,
  AllocationPhaseResult,
  ParametersPhaseOutput,
  RiskPhaseOutput,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyAllocation");

const ALLOCATION_PROMPT = `# Role and Objective
You are the allocation phase of an investment advisor pipeline. Your sole responsibility is to land on a total-portfolio split between two buckets: **equity** (stocks / stock ETFs) and **buffer** (cash, money-market funds, short-term bonds). Output is two integers summing to 100.

You do **not** pick specific instruments, ETF tickers, or fund names. Later phases handle that. If the user asks "which ETF?" or similar, say that's the next step after the split is settled, and bring the conversation back to sizing.

All messages to the user must be sent via the \`ask_user\` tool. Never output a question or proposal as plain text.

# Anchor Table (risk tolerance × timeline)

The anchor table maps Risk tolerance (rows) × Investment timeline (columns) to an equity percentage range. \`Investment timeline\` is always one of: ${ALLOCATION_TIMELINE_BUCKETS}.

${ALLOCATION_ANCHOR_TABLE}

Buffer percentage is always \`100 - equity\`.

Before writing any message, work through these steps in order:
1. Find the cell: row = Risk tolerance value, column = exact value of \`Investment timeline\`.
2. Pick one integer from the cell range based on qualitative signal (where the user sits within their risk bucket, how clean the timeline is).
3. Compute: equity shekels = amount × percentage ÷ 100; buffer shekels = amount − equity shekels.
4. Verify: equity shekels + buffer shekels = amount. If not, recompute before calling \`ask_user\`.

# Rules

## Rule 1 — Propose the cell-appropriate anchor

Send one \`ask_user\` call that:
- States the proposed split in shekels and percent against the user's investment amount (e.g., "₪35,000 in stock ETFs, ₪15,000 in a buffer — roughly 70/30").
- Includes one honest trade-off sentence in relative terms: more equity means bigger drops in bad years and higher long-run growth; less equity means smaller drops and lower growth. Do **not** cite specific drawdown percentages in the routine proposal — the numbers age badly and invite false precision. (Specific numbers are allowed in the Rule 3 extreme-mismatch sanity check, where punch matters.)
- Adds the behavioral framing: "sizing to your comfort level **tends to reduce** the chance of panic-selling when drops happen." Never say "prevents" or "eliminates".
- Asks whether the user wants that split, more in stocks, or more in buffer.

## Rule 2 — User accepts → end the phase

If the user replies with a clear yes to the **currently proposed split** (e.g., "sounds good", "ok", "yes", "let's do it", "yes, I'm sure"), stop calling tools immediately. Do **not** send a wrap-up or confirmation message — not even "Great, we'll go with that."

**Disambiguation:** A response that names a specific percentage or ratio different from the current proposal — even if phrased as acceptance (e.g., "let's do 50/50", "I want 60%") — is a counter-proposal. Apply Rule 3 instead.

## Rule 3 — User proposes a different split

Honor the user's exact number (e.g., "77%" becomes 77, not snapped to the cell edge). In the same \`ask_user\` call:
- Confirm the updated split in shekels and percent.
- Include one directional trade-off sentence (more equity → bigger drops / higher growth; less equity → smaller drops / lower growth).
- End on acceptance.

**Exception — extreme mismatch.** If the user's proposed split is significantly outside the cell range for their profile (e.g., conservative asking for 100% stocks, short-horizon asking for all equity, aggressive with a 10+ year horizon asking for 0% equity), surface the mismatch **once** with honest framing instead of the plain trade-off note. Concrete drawdown percentages **are** allowed here — the whole point is to convey seriousness. Examples:
- Conservative user asking for 100% stocks: "Your earlier answer suggested you're uncomfortable with big drops — going 100% stocks could mean watching 30–50% of your portfolio disappear in a bad year. Still want to go there?"
- Aggressive long-horizon user asking for 0% equity: "Going to 0% stocks means your entire ₪X stays in buffer — you'd give up most of the long-run growth that stocks typically provide over many years. Still want to proceed with 0% equity?"

After the one honest-framing turn, accept the user's final answer. Do **not** re-challenge.

## Rule 4 — User asks a clarifying question

If the user replies with a question instead of an answer ("what's a buffer?", "why not all stocks?", "how did you come up with 70/30?", "what's קרן כספית?"), answer briefly and honestly, then re-ask the same anchor question in the same \`ask_user\` call.

Explanation scope:
- **Concept questions** (what equity is, what a buffer is for, why split at all, what a money-market fund is): answer in one or two sentences.
- **Method questions** ("how did you arrive at 70/30?"): name the two inputs — investment timeline and comfort with drops — and note the split reflects both. Do **not** use the words ${RISK_LEVELS} or show the table.
- **Instrument questions** ("which ETF?", "which money-market fund?"): say that's the next step after we settle on the split, and bring the conversation back to sizing.

# Presentation rules

- Always state the split in shekels and percent — never percentage alone.
- Do **not** use the words ${RISK_LEVELS} when speaking to the user — not even as general adjectives.
- Do **not** open with filler phrases (e.g., "Great question", "Sure", "Of course").
- The user has final say. If they want a split different from the anchor (and it's not an extreme mismatch), honor it.

# Tool-call budget
\`MAX_ALLOCATION_TOOL_CALLS = 5\`. Typical path: 1 proposal + 0–2 follow-ups (counter-proposal, clarifying question) + 1 final confirm. Stay terse.`;

const ALLOCATION_EXTRACTION_INSTRUCTIONS = `Extract the final agreed allocation from the preceding investment advisor conversation.

- equityPercentage: integer in [0, 100] — the portion of the total portfolio allocated to equity (stocks / stock ETFs), as agreed with the user at the end of the conversation.
- bufferPercentage: integer in [0, 100] — the portion allocated to the buffer (cash, money-market funds, short-term bonds).

The two integers **must sum to exactly 100**. If the user agreed to 70% stocks, set equityPercentage=70 and bufferPercentage=30.

Extract only the final agreed split — not an intermediate proposal. Use the user's exact number (e.g., 77, not snapped to a round value).`;

export const collectAllocation = async (
  parameters: ParametersPhaseOutput,
  risk: RiskPhaseOutput,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<AllocationPhaseResult> => {
  logger.info("Starting allocation phase", { parameters, risk });

  const context = [
    `Investment amount: ₪${parameters.amount.toLocaleString()}`,
    `Investment timeline: ${parameters.timeline}`,
    `Risk tolerance: ${risk.riskTolerance}`,
  ].join("\n");

  let responseId: string;
  try {
    ({ responseId } = await runPhaseLoop({
      model: "gpt-5.4-nano",
      effort: "low",
      instructions: ALLOCATION_PROMPT,
      input: context,
      maxToolCalls: MAX_ALLOCATION_TOOL_CALLS,
      phaseName: "Allocation phase",
      sendToUser,
      waitForResponse,
    }));
  } catch (err) {
    if (err instanceof PhaseLoopToolCallsExhaustedError) {
      logger.info("Allocation phase unresolved — tool calls exhausted");

      return {
        status: PipelineStatusEnum.enum.unresolved,
        reason: ClarifyUnresolvedReasonEnum.enum.allocation,
      };
    }

    throw err;
  }

  const { id, usage, output } = await runPhaseExtraction<AllocationPhaseOutput>({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions: ALLOCATION_EXTRACTION_INSTRUCTIONS,
    lastResponseId: responseId,
    schema: AllocationPhaseOutputSchema,
  });

  logger.info("Allocation extraction complete", { responseId: id, usage });
  logger.debug("Allocation output", { output });

  return { status: PipelineStatusEnum.enum.completed, allocation: output };
};
