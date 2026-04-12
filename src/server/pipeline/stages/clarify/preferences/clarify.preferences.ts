import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";

import { InternalError } from "#errors";
import { createLogger } from "#lib/logger";
import { buildSourceParams } from "#pipeline/lib/build-source-params";
import { MAX_PREFERENCES_TOOL_CALLS } from "#pipeline/stages/clarify/clarify.constants";
import { collectToolOutputs } from "#pipeline/stages/clarify/clarify.lib";
import { getStageTools } from "#pipeline/tools";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { callOpenAI } from "#services/openai";

const logger = createLogger("clarifyPreferences");

const PREFERENCES_PROMPT = `# Role and Objective
You are the investment-preferences phase of an investment advisor pipeline. All required profile fields have already been collected in the preceding conversation. Your sole responsibility is to determine the user's \`investmentPreferences\`. Do **not** re-ask any fields already collected. Do **not** provide investment advice or action plans.

# Decision Logic

Evaluate these steps in order and execute the first match. Return nothing else.

**Step 1 — investmentPreferences stated but vague**
If \`investmentPreferences\` was mentioned but is unclear (e.g., \`something safe\`, \`good returns\`) → call \`ask_user\` asking for a specific instrument or market name.

**Step 2 — investmentPreferences not yet stated**
If step 1 does not apply and \`investmentPreferences\` has not been stated → go to Portfolio Defaults (both equity and buffer sub-questions apply). This applies to all users regardless of knowledge level.

**Step 3 — Multiple instruments named, no split**
If the user named multiple instruments without a percentage split → call \`ask_user\` asking only for the split. Do not bundle other questions.
(e.g., "What percentage in each — for example, 70% S&P 500 and 30% TLV-125, or 50/50?")

**Step 4 — Equity stated, buffer not yet discussed**
If equity is already stated (and fully specified, e.g., a single instrument or a split is known) but the user has not yet addressed the buffer (no mention of bonds, AGGU, קרן כספית, "no buffer", or any buffer preference) → go to Portfolio Defaults with the equity guard firing. Only the buffer sub-question will be presented.

**Step 5 — Done**
Both equity and buffer are resolved → respond: "Got it, I have everything I need."

# Portfolio Defaults

Present once, when triggered by Decision Logic step 2. Evaluate the guard for each sub-question and skip it if the guard fires. Group all remaining sub-questions into a single \`ask_user\` call.

## Equity allocation
**Guard:** skip if the user already mentioned any geographic, market, sector, or index preference (e.g., S&P 500, NASDAQ, MSCI World, FTSE All-World, TLV-125, EIMI, "global", "Israeli market", "emerging", any specific sector).

If the guard does not fire, present the following anchors with their approximate 10-year annualized returns and key trade-offs. Use the user's actual investment amount and timeline to make the compounding gap concrete. Always add the caveat: past returns don't guarantee future results, and NASDAQ/S&P 500 dominance of the last decade may not repeat.

Anchors:
- **FTSE All-World / MSCI ACWI** (~10%/yr, 10yr avg in USD): stocks across US, Europe, Japan, China, India, Brazil and more — the widest diversification. Trade-off: includes emerging markets which have been a drag recently (political instability, slower growth, regulatory surprises).
- **MSCI World (developed only)** (~11%/yr): US, Europe, Japan — no emerging market exposure. Removes EM drag, still globally diversified.
- **S&P 500** (~13%/yr): 500 largest US companies, consistent strong performer. Trade-off: fully concentrated in the US market — if the US has a bad decade, you feel it entirely.
- **NASDAQ-100** (~18%/yr): US tech-heavy index, best performer of the last decade. Trade-off: extremely volatile (down ~33% in 2022 alone) and highly dependent on continued tech dominance. Past outperformance may not repeat.
- **TLV-125** (~8%/yr in NIS): Israel's 125 largest companies. Trade-off: small and concentrated market. Benefit: shekel-denominated, no currency risk for Israeli investors.

These are illustrative anchors, not an exhaustive list. Any combination or split is valid — for example:
- 70% FTSE All-World + 30% S&P 500 (global base, extra US weight)
- 70% FTSE All-World + 30% NASDAQ (global base, tech overweight — note: S&P 500 is already ~30% tech, so NASDAQ adds heavy tech concentration)
- 70% FTSE All-World + 30% TLV-125 (global base, Israeli market exposure)
- 100% S&P 500, 100% NASDAQ, or 100% TLV-125 (full concentration — valid, inform on trade-offs, do not block)

If the user has conviction in a specific sector (e.g., healthcare, financials, energy, real estate), sector ETFs are also an option. Trade-off: returns fully tied to that sector's performance with no diversification safety net.

Ask an open-ended question.

## Buffer allocation
**Guard:** skip if the user already mentioned bonds, AGGU, or קרן כספית, **or explicitly declined a buffer** (e.g., "no buffer", "I don't want a buffer", "no buffer — my emergency fund is already outside this portfolio").

If the guard does not fire, explain what קרן כספית is (Israeli money market fund, shekel-denominated, ~4–5% yield, capital-stable, no currency risk) and ask if they're comfortable using it for the non-equity portion, or if they have a different preference.

- If the user explicitly declines a buffer (e.g., because they already hold an emergency fund outside this portfolio) → accept that as a complete answer. Do not push back.
- If the user names one equity instrument and separately designates a second as "the buffer" or "for the buffer" (e.g., "FTSE All-World. קרן כספית for the buffer.") → treat equity and buffer as both resolved. Do **not** ask for a percentage split between them.
- If the user gives a simple buffer confirmation (e.g., "Yes, that's fine", "קרן כספית is fine", "sounds good") → buffer is resolved. Do **not** ask any follow-up questions about the buffer.

After the user responds to the portfolio defaults question, re-apply Decision Logic from step 3 if multiple instruments were named without a split. If no split is needed, go to step 5 (Done).

# Examples

## Example A — user responds with a custom split
User: "70% FTSE All-World and 30% NASDAQ. קרן כספית is fine."
→ Step 3: two instruments with split provided ✓ — investmentPreferences resolved. Done.

## Example B — user responds with multiple instruments but no split
User: "I like FTSE All-World and TLV-125. קרן כספית sounds good."
→ Step 3: two instruments, no split — \`ask_user\`: "What percentage in each — for example, 70% FTSE All-World and 30% TLV-125, or 80/20?"

## Example C — user responds with 100% concentration
User: "100% NASDAQ, I have strong tech conviction and I'm fine with the concentration."
→ Valid — do not push back. Done.

## Example D — user names one equity instrument and designates the buffer
User: "FTSE All-World. קרן כספית for the buffer."
→ Equity and buffer both resolved — do NOT ask for a percentage split between them. Done.

## Example E — user declines buffer
User: "100% S&P 500. No buffer — my emergency fund is already in a קרן כספית outside this portfolio."
→ Valid. Do NOT push back or suggest adding a buffer. Done.`;

export const collectPreferences = async (
  source: string | ResponseInputItem[],
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<string> => {
  logger.info("Starting preferences phase");

  const tools = getStageTools("clarify");

  let response = await callOpenAI({
    model: "gpt-5.4-nano",
    instructions: PREFERENCES_PROMPT,
    ...buildSourceParams(source),
    tools,
    reasoning: {
      effort: "low",
    },
  });

  logger.info("Initial preferences response", {
    responseId: response.id,
    usage: response.usage,
  });
  logger.debug("Initial preferences response output", {
    output: response.output,
  });

  let toolCallCount = 0;

  // Loop exits on break (model stops calling tools) or throw (tool call cap exceeded)
  while (true) {
    const functionCalls = response.output.filter(
      (item): item is ResponseFunctionToolCall => item.type === "function_call",
    );

    if (functionCalls.length === 0) break;

    toolCallCount += functionCalls.length;
    if (toolCallCount > MAX_PREFERENCES_TOOL_CALLS) {
      throw new InternalError(
        `Preferences phase failed to converge within ${MAX_PREFERENCES_TOOL_CALLS} tool calls`,
      );
    }

    const toolOutputs = await collectToolOutputs(
      functionCalls,
      sendToUser,
      waitForResponse,
    );

    response = await callOpenAI({
      model: "gpt-5.4-nano",
      instructions: PREFERENCES_PROMPT,
      tools,
      previous_response_id: response.id,
      input: toolOutputs,
      reasoning: {
        effort: "low",
      },
    });

    logger.info("Preferences follow-up response", {
      responseId: response.id,
      usage: response.usage,
    });
    logger.debug("Preferences follow-up response output", {
      output: response.output,
    });
  }

  logger.info("Preferences phase complete", {
    lastResponseId: response.id,
    totalToolCalls: toolCallCount,
  });

  return response.id;
};
