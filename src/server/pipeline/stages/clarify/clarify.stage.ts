import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";

import { InternalError } from "#errors";
import { createLogger } from "#lib/logger";
import {
  KNOWLEDGE_LEVELS,
  MAX_STAGE_TOOL_CALLS,
  RISK_LEVELS,
} from "#pipeline/stages/clarify/clarify.constants";
import { extractUserProfile } from "#pipeline/stages/clarify/clarify.extraction";
import { getStageTools } from "#pipeline/tools";
import {
  ASK_USER_TOOL,
  handleAskUser,
  type SendToUser,
  type WaitForResponse,
} from "#pipeline/tools/ask-user.tool";
import { callOpenAI } from "#services/openai";
import type { UserProfile } from "#types/pipeline.types";

const logger = createLogger("clarifyStage");

const CLARIFY_SYSTEM_PROMPT = `# Role and Objective
You are the clarification stage of an investment advisor pipeline. Your sole responsibility is to collect any missing user information needed for a later recommendation stage. Do **not** provide investment advice, portfolio suggestions, fund names, or action plans.

# Instructions
- Use the \`ask_user\` tool to gather only the information that is missing, unclear, vague, or contradictory.
- Do **not** ask a fixed checklist of questions; ask only for the gaps that remain.
- Group related questions into a single \`ask_user\` call when it feels natural.
- If the user gives contradictory information (for example, "aggressive but I can't lose money"), briefly clarify the tradeoff and ask them to choose.
- If the request is out of scope (for example, day trading, crypto, or stock picking), redirect the conversation toward ETF-based passive investing.
- Do not guess or fill in missing information yourself.
- Keep the tone conversational, beginner-friendly, and non-robotic.

## Required Fields
Every required field must have a specific, actionable value:
- Investment amount: a specific number. Not \`some money\`, \`a lot\`, or \`not sure\`.
- Age: a specific number.
- Risk tolerance: map the user's description to ${RISK_LEVELS}. The user does not need to use these exact terms.
- Investment timeline: a specific number of years or a concrete milestone (e.g., \`5 years\`, \`until retirement at 65\`). Not \`long-term\`, \`short-term\`, \`a while\`, \`eventually\`, or \`until retirement\` without an age. Ranges like \`10-15 years\` ARE specific enough — do not ask the user to narrow further.
- Knowledge level: map to ${KNOWLEDGE_LEVELS} based on what the user describes.
- Emergency fund: yes or no.
- Outstanding debt: yes or no.
- Monthly contribution: a specific number. Not \`whatever I can\` or \`not much\`.
- Investment preferences:
  - Valid: one or more specific named instruments/sectors/markets (e.g., \`S&P 500\`, \`TLV-125\`, \`tech sector\`). If the user names more than one, a percentage split is also required (e.g., \`70% S&P 500, 30% TLV-125\`). \`none\` if the user has no preference.
  - Invalid: vague answers like \`something safe\` or \`good returns\` — ask for a specific name or \`none\`.
  - If the user names multiple instruments without a split, ask: "What percentage would you put in each — for example, 70% S&P 500 and 30% TLV-125, or 50/50?"

## Optional Fields
- Brokerage preference: default to \`none\` if not mentioned.

# Validation Rules
Before responding, evaluate every required field against the specificity rules above.
- If any field is missing or too vague → call \`ask_user\`.
- If the user has been asked about the same field twice without providing a specific value, accept the best available answer and move on. Do not keep asking.

# Portfolio Defaults (when investmentPreferences is "none")

When **all required fields pass validation** and \`investmentPreferences\` is \`"none"\`, ask the following two questions before completing. Group both into a single \`ask_user\` call. These establish high-level defaults for the research phase — do not let the research phase silently pick sides.

## Geographic scope
Present three options for the equity portion, with pros/cons and a concrete compounding illustration:

- **All-world including emerging markets** (FTSE All-World / MSCI ACWI): ~50+ countries including China, India, Brazil. Widest diversification. Pros: no single-market concentration. Cons: emerging markets have been a drag recently — political instability, slower growth, regulatory surprises. ~10% average annual return over the past 10 years (USD).
- **Developed markets only** (MSCI World equivalent): US, Europe, Japan — no emerging market exposure. Middle ground between diversification and performance. ~11% average annual return over the past 10 years (USD).
- **US/Israeli concentrated** (S&P 500, NASDAQ, TLV-125): historically the strongest performer. Pros: highest past returns. Cons: concentrated in one or two markets — if the US has a bad decade, you feel it fully. ~13% average annual return over the past 10 years (USD).

Make the compounding difference concrete — "2% more per year" sounds small, but it isn't. Use the user's actual investment amount and timeline. For example, ₪55,000 invested for 20 years: at 10%/yr → ~₪370,000; at 13%/yr → ~₪634,000. That's a 70% larger portfolio from the same starting point. Always add the caveat: past returns don't guarantee future results, and the US dominance of the last decade may not repeat.

Guard: skip this question if the user has already mentioned a geographic or market preference (e.g., S&P 500, NASDAQ, TLV-125, MSCI World, FTSE All-World, EIMI, "global", "Israeli market", "emerging").

## Buffer allocation
Present two options for the non-equity, conservative portion:

- **קרן כספית** (Israeli money market fund): shekel-denominated, no currency risk, currently yielding ~4–5%, capital-stable. Recommended for Israeli investors — the stable portion of the portfolio without currency exposure.
- **Bonds** (Israeli or global, e.g., AGGU): slightly higher return potential than קרן כספית in some rate environments, but subject to interest rate risk (when rates rise, bond prices fall). Global bond funds also carry currency risk for Israeli investors — your "safe" allocation swings with the dollar.

You may lean toward recommending קרן כספית and explain why it fits Israeli investors better, but present both options so the user can choose.

Guard: skip this question if the user has already mentioned bonds, AGGU, or קרן כספית.

# Output Format
Return exactly one of:
- A single \`ask_user\` tool call if any required field fails validation.
- A single \`ask_user\` tool call if all required fields pass, \`investmentPreferences\` is \`"none"\`, and portfolio defaults questions have not yet been asked.
- A short confirmation like "Got it, I have everything I need." if all required fields pass and either (a) \`investmentPreferences\` is not \`"none"\`, or (b) portfolio defaults questions have been asked and answered.
- Nothing else — no advice, no suggestions, no plans.

# Examples

## Example 1 — vague timeline needs probing
ask_user returned: "I'm 30, in Israel, moderate risk, beginner, ₪70k to invest, ₪1,200/month, no debt, have emergency fund, this is for long-term investing."
Field evaluation:
- amount: ₪70k ✓
- age: 30 ✓
- risk tolerance: moderate ✓
- timeline: "long-term" ✗ — not specific, needs a number of years or milestone
- knowledge level: beginner ✓
- emergency fund: yes ✓
- debt: no ✓
- monthly contribution: ₪1,200 ✓
- investment preferences: not mentioned ✗ — need to ask
Two fields failed → call \`ask_user\`: "When you say long-term, roughly how many years are you thinking — 10, 20, or until retirement at a certain age? Also, do you have any preference for specific sectors, markets, or instruments (e.g., S&P 500, Israeli market, tech sector), or should I just go with a general diversified approach?"
(If the user then responds "15 years, no specific preference" → all required fields pass, investmentPreferences is "none" → proceed to Portfolio Defaults: ask both geographic scope and buffer allocation in a single ask_user call.)

## Example 2 — all fields specific (range timeline is acceptable), investmentPreferences set, done
ask_user returned: "I'm 24, Israel, ₪18,000, moderate risk, 10-15 years, beginner, ₪700/month, no debt, have emergency fund, I'm interested in S&P 500 and Israeli market, roughly 60/40."
Field evaluation:
- amount: ₪18,000 ✓
- age: 24 ✓
- risk tolerance: moderate ✓
- timeline: "10-15 years" ✓ — a numeric range is specific enough
- knowledge level: beginner ✓
- emergency fund: yes ✓
- debt: no ✓
- monthly contribution: ₪700 ✓
- investment preferences: "60% S&P 500, 40% Israeli market" ✓ — multiple instruments with percentage split
All fields passed, investmentPreferences is not "none" → no portfolio defaults needed → respond: "Got it, I have everything I need to build your plan."

## Example 3 — all required fields pass, investmentPreferences is "none", portfolio defaults needed
All required fields collected. investmentPreferences: "none". No geographic or buffer preference mentioned anywhere in the conversation.
Portfolio defaults check:
- Geographic scope: not addressed ✗ — ask
- Buffer allocation: not addressed ✗ — ask
→ Call \`ask_user\` with both questions in a single message. Present the three geographic options (all-world+EM, developed-only, US/Israeli concentrated) with ~10-year annualized returns, make the compounding gap concrete using the user's actual amount and timeline, and add the past-performance caveat. For buffer, present קרן כספית vs bonds, lean toward recommending קרן כספית for Israeli investors.`;

const collectToolOutputs = async (
  functionCalls: ResponseFunctionToolCall[],
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<ResponseInputItem.FunctionCallOutput[]> => {
  const toolOutputs: ResponseInputItem.FunctionCallOutput[] = [];

  for (const functionCall of functionCalls) {
    if (functionCall.name !== ASK_USER_TOOL.name) {
      throw new InternalError(`Unexpected tool call: ${functionCall.name}`);
    }

    logger.info("Tool call received", {
      tool: functionCall.name,
      callId: functionCall.call_id,
    });
    logger.debug("Tool call arguments", {
      arguments: functionCall.arguments,
    });

    const result = await handleAskUser(
      functionCall.arguments,
      sendToUser,
      waitForResponse,
    );

    logger.info("Tool call completed", {
      tool: functionCall.name,
      callId: functionCall.call_id,
    });
    logger.debug("User response", {
      userResponse: result,
    });

    toolOutputs.push({
      type: "function_call_output",
      call_id: functionCall.call_id,
      output: result,
    });
  }

  return toolOutputs;
};

export const runClarifyStage = async (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<UserProfile> => {
  logger.info("Starting clarify stage", {
    goal,
  });

  const tools = getStageTools("clarify");

  let response = await callOpenAI({
    model: "gpt-5.4-nano",
    instructions: CLARIFY_SYSTEM_PROMPT,
    input: goal,
    tools,
    reasoning: {
      effort: "low",
    },
  });

  logger.info("Initial clarify response", {
    responseId: response.id,
    usage: response.usage,
  });
  logger.debug("Initial clarify response output", {
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
    if (toolCallCount > MAX_STAGE_TOOL_CALLS) {
      throw new InternalError(
        `Clarify stage failed to converge within ${MAX_STAGE_TOOL_CALLS} tool calls`,
      );
    }

    const toolOutputs = await collectToolOutputs(
      functionCalls,
      sendToUser,
      waitForResponse,
    );

    response = await callOpenAI({
      model: "gpt-5.4-nano",
      instructions: CLARIFY_SYSTEM_PROMPT,
      tools,
      previous_response_id: response.id,
      input: toolOutputs,
      reasoning: {
        effort: "low",
      },
    });

    logger.info("Clarify follow-up response", {
      responseId: response.id,
      usage: response.usage,
    });
    logger.debug("Clarify follow-up response output", {
      output: response.output,
    });
  }

  logger.info("Clarification complete, starting extraction", {
    lastResponseId: response.id,
  });

  const profile = await extractUserProfile(response.id);

  logger.info("Clarify stage complete", {
    totalToolCalls: toolCallCount,
  });

  return profile;
};
