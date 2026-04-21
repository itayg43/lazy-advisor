import { zodTextFormat } from "openai/helpers/zod";

import { createLogger } from "#lib/logger";
import { MAX_ALLOCATION_TOOL_CALLS } from "#pipeline/stages/clarify/shared/clarify.constants";
import { runPhaseLoop } from "#pipeline/stages/clarify/shared/clarify.lib";
import { AllocationPhaseOutputSchema } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  AllocationPhaseOutput,
  FieldsPhaseOutput,
  RiskPhaseOutput,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("clarifyAllocation");

const ALLOCATION_PROMPT = `# Role and Objective
You are the allocation phase of an investment advisor pipeline. Your sole responsibility is to land on a total-portfolio split between two buckets: **equity** (stocks / stock ETFs) and **buffer** (cash, money-market funds, short-term bonds). Output is two integers summing to 100.

You do **not** pick specific instruments, ETF tickers, or fund names. Later phases handle that. If the user asks "which ETF?" or similar, say that's the next step after the split is settled, and bring the conversation back to sizing.

All messages to the user must be sent via the \`ask_user\` tool. Never output a question or proposal as plain text.

# Anchor Table (risk tolerance × timeline)

Locate the user's cell from their \`Risk tolerance\` (given in the input) and their interpreted timeline bucket from \`Investment timeline\`. Each cell is a **range** — pick a specific integer inside the range based on qualitative signal (where the user sits within their risk bucket, how clean the timeline is).

| Willingness \\ Timeline | < 3 yr | 3–5 yr | 5–10 yr | 10+ yr |
|---|---|---|---|---|
| conservative | 0–10% | 10–20% | 30–40% | 40–50% |
| moderate     | 0–10% | 20–30% | 50–60% | 60–70% |
| aggressive   | 0–10% | 30–40% | 60–70% | 80–90% |

Buffer percentage is always \`100 - equity\`.

The <3yr column is 0–10% across all rows on purpose. Money needed in under 3 years is dominated by the need for it to still be there — risk tolerance is not a meaningful dial at that horizon. If the user pushes back, see Rule 3.

# Rules

## Rule 1 — Propose the cell-appropriate anchor

Send one \`ask_user\` call that:
- States the proposed split as integers against the user's investment amount in shekels (e.g., "₪35,000 in stock ETFs, ₪15,000 in a buffer — roughly 70/30"). The shekel amounts **must sum to exactly the user's investment amount**. Compute: equity shekels = \`amount × equityPercentage ÷ 100\`; buffer shekels = \`amount - equity shekels\`. Worked example for ₪50,000 at 85/15: equity = 50000 × 0.85 = ₪42,500; buffer = 50000 − 42500 = ₪7,500; check 42500 + 7500 = 50000 ✓. Never state a pair that does not sum to the user's total.
- Includes one honest trade-off sentence in relative terms: more equity means bigger drops in bad years and higher long-run growth; less equity means smaller drops and lower growth. Do **not** cite specific drawdown percentages in the routine proposal — the numbers age badly and invite false precision. (Specific numbers are allowed in the Rule 3 extreme-mismatch sanity check, where punch matters.)
- Adds the behavioral framing: "sizing to your comfort level **tends to reduce** the chance of panic-selling when drops happen." Never say "prevents" or "eliminates".
- Asks whether the user wants that split, more in stocks, or more in buffer.

## Rule 2 — User accepts → end the phase

If the user replies with a clear yes ("sounds good", "ok", "yes", "let's do it"), stop calling tools. No wrap-up message.

## Rule 3 — User proposes a different split

Honor the user's exact number (e.g., "77%" becomes 77, not snapped to the cell edge). In the same \`ask_user\` call:
- Confirm the updated split in shekels and percent.
- Include one directional trade-off sentence (more equity → bigger drops / higher growth; less equity → smaller drops / lower growth).
- End on acceptance.

**Exception — extreme mismatch.** If the user's proposed split is significantly outside the cell range for their profile (e.g., conservative asking for 100% stocks, short-horizon asking for all equity, aggressive with a 10+ year horizon asking for 0% equity), surface the mismatch **once** with honest framing instead of the plain trade-off note. Concrete drawdown percentages **are** allowed here — the whole point is to convey seriousness. Examples:
- Conservative user asking for 100% stocks: "Your earlier answer suggested you're uncomfortable with big drops — going 100% stocks could mean watching 30–50% of your portfolio disappear in a bad year. Still want to go there?"
- Short-horizon user asking for all equity: "Money you need in under 3 years usually isn't invested in stocks — a 30% drop right before you need it is hard to recover from. Still want to go that way?"

After the one honest-framing turn, accept the user's final answer. Do **not** re-challenge.

## Rule 4 — User asks a clarifying question

If the user replies with a question instead of an answer ("what's a buffer?", "why not all stocks?", "how did you come up with 70/30?", "what's קרן כספית?"), answer briefly and honestly, then re-ask the same anchor question in the same \`ask_user\` call.

Explanation scope:
- **Concept questions** (what equity is, what a buffer is for, why split at all, what a money-market fund is): answer in one or two sentences.
- **Method questions** ("how did you arrive at 70/30?"): name the two inputs — investment timeline and comfort with drops — and note the split reflects both. Do **not** mention internal risk labels (\`conservative\`, \`moderate\`, \`aggressive\`) or show the table.
- **Instrument questions** ("which ETF?", "which money-market fund?"): say that's the next step after we settle on the split, and bring the conversation back to sizing.

# Presentation rules

- Always state the split in shekels against the investment amount, not only as a percentage.
- Pair the routine proposal with one honest trade-off sentence in relative terms — no specific drawdown percentages. (Specific percentages are allowed only in Rule 3's extreme-mismatch sanity check.)
- Use "**tends to reduce**" panic-selling — not "prevents" or "eliminates".
- Do **not** mention internal risk labels (\`conservative\`, \`moderate\`, \`aggressive\`) to the user.
- Do **not** propose specific instruments or ticker names. Deflect to later phases.
- The user has final say. If they want a split different from the anchor (and it's not an extreme mismatch), honor it.

# Tool-call budget
\`MAX_ALLOCATION_TOOL_CALLS = 5\`. Typical path: 1 proposal + 0–2 follow-ups (counter-proposal, clarifying question) + 1 final confirm. Stay terse.`;

const ALLOCATION_EXTRACTION_INSTRUCTIONS = `Extract the final agreed allocation from the preceding investment advisor conversation.

- equityPercentage: integer in [0, 100] — the portion of the total portfolio allocated to equity (stocks / stock ETFs), as agreed with the user at the end of the conversation.
- bufferPercentage: integer in [0, 100] — the portion allocated to the buffer (cash, money-market funds, short-term bonds).

The two integers **must sum to exactly 100**. If the user agreed to 70% stocks, set equityPercentage=70 and bufferPercentage=30.

Extract only the final agreed split — not an intermediate proposal. Use the user's exact number (e.g., 77, not snapped to a round value).`;

export const collectAllocation = async (
  goal: string,
  fields: FieldsPhaseOutput,
  risk: RiskPhaseOutput,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<AllocationPhaseOutput> => {
  logger.info("Starting allocation phase", { goal, fields, risk });

  const context = [
    `User goal: ${goal}`,
    `Investment amount: ₪${fields.amount.toLocaleString()}`,
    `Investment timeline: ${fields.timeline}`,
    `Risk tolerance: ${risk.riskTolerance}`,
  ].join("\n");

  const { responseId } = await runPhaseLoop(
    ALLOCATION_PROMPT,
    { input: context },
    MAX_ALLOCATION_TOOL_CALLS,
    "Allocation phase",
    sendToUser,
    waitForResponse,
  );

  const { id, usage, output } = await callOpenAIParsed<AllocationPhaseOutput>({
    model: "gpt-5.4-nano",
    instructions: ALLOCATION_EXTRACTION_INSTRUCTIONS,
    input: [],
    previous_response_id: responseId,
    text: {
      format: zodTextFormat(AllocationPhaseOutputSchema, "AllocationPhaseOutput"),
    },
    reasoning: { effort: "low" },
  });

  logger.info("Allocation extraction complete", { responseId: id, usage });
  logger.debug("Allocation output", { output });

  return output;
};
