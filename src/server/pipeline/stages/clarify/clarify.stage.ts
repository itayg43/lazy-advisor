import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputItem } from "openai/resources/responses/responses";

import { InternalError } from "#server/errors";
import { createLogger } from "#server/lib/logger";
import {
  KnowledgeLevel,
  RiskTolerance,
  UserProfileSchema,
} from "#server/schemas/pipeline.schema";
import { callOpenAI, callOpenAIParsed } from "#server/services/openai";
import type { UserProfile } from "#server/types/pipeline.types";
import { MAX_STAGE_TOOL_CALLS } from "#shared/constants/constants";
import { getStageTools } from "../../tools";
import type { SendToUser, WaitForResponse } from "../../tools/ask-user.tool";
import { handleAskUser } from "../../tools/ask-user.tool";

const logger = createLogger("clarifyStage");

const CLARIFY_MODEL = "gpt-5.4-mini";

const riskLevels = RiskTolerance.options.map((o) => `\`${o}\``).join(", ");
const knowledgeLevels = KnowledgeLevel.options.map((o) => `\`${o}\``).join(", ");

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

## Required Information
Every required field must have a specific, actionable value:
- Investment amount: a specific number
- Age: a specific number
- Risk tolerance: map the user's description to the most appropriate of ${riskLevels}. The user does not need to use these exact terms.
- Investment timeline: a specific number of years or a concrete milestone (for example, \`5 years\` or \`until retirement at 65\`)
- Location or country
- Knowledge level: map to ${knowledgeLevels} based on what the user describes
- Whether they have an emergency fund: yes or no
- Whether they have outstanding debt: yes or no
- Monthly contribution amount: a specific number

## Optional Information
- Brokerage preference: default to \`none\` if not mentioned

# Field Validation
Before responding, evaluate every required field. A field passes only if it has a specific, actionable value.

## When to Probe
Call \`ask_user\` when any field value is:
- Missing entirely
- A vague category instead of a number or concrete milestone

### Values That Are NOT Specific Enough
- Timeline: \`long-term\`, \`short-term\`, \`a while\`, \`eventually\`, \`until retirement\` (without an age). These must be converted to a number of years or an age-based milestone.
- Amount: \`some money\`, \`a lot\`, \`not sure\`. Must be a number.
- Monthly contribution: \`whatever I can\`, \`not much\`. Must be a number.

# Output Format
Return exactly one of the following:
- A single \`ask_user\` tool call if any field is missing or does not meet the specificity rules above.
- A short confirmation like "Got it, I have everything I need." if all fields are specific and complete.
- Do not include anything else — no advice, no suggestions, no plans.

# Examples

## Example 1 — vague timeline needs probing
ask_user returned: "I'm 30, in Israel, moderate risk, beginner, ₪70k to invest, ₪1,200/month, no debt, have emergency fund, this is for long-term investing."
Field evaluation:
- amount: ₪70k ✓
- age: 30 ✓
- risk tolerance: moderate ✓
- timeline: "long-term" ✗ — not specific, needs a number of years or milestone
- location: Israel ✓
- knowledge level: beginner ✓
- emergency fund: yes ✓
- debt: no ✓
- monthly contribution: ₪1,200 ✓
One field failed → call \`ask_user\`: "When you say long-term, roughly how many years are you thinking — 10, 20, or until retirement at a certain age?"

## Example 2 — all fields specific, done
ask_user returned: "25, Israel, ₪35,000, aggressive, 30 years, intermediate, ₪1,500/month, no debt, have emergency fund, use Meitav."
Field evaluation:
- amount: ₪35,000 ✓
- age: 25 ✓
- risk tolerance: aggressive ✓
- timeline: 30 years ✓
- location: Israel ✓
- knowledge level: intermediate ✓
- emergency fund: yes ✓
- debt: no ✓
- monthly contribution: ₪1,500 ✓
All fields passed → respond: "Got it, I have everything I need to build your plan."`;

const EXTRACTION_SYSTEM_PROMPT = `# Role and Objective
You are the extraction stage of an investment advisor pipeline. Your sole responsibility is to extract a structured user profile from the preceding conversation. Do **not** infer, assume, or add information that was not explicitly discussed.

# Instructions
- Extract each field strictly from what the user said in the conversation.
- Stay close to the user's actual words. Do not paraphrase, summarize, or embellish.
- If a field was not discussed or remains ambiguous, use the specified default.

# Field Rules
- **goal**: preserve the user's original wording with enough context for downstream stages. Do not reduce to generic phrases like "start investing" — include the specifics the user mentioned.
- **amount**: extract the exact number. Convert shorthand (e.g., "₪55k" → 55000).
- **age**: extract the exact number.
- **riskTolerance**: map to ${riskLevels} based on what the user described.
- **timeline**: extract the specific timeframe the user stated (e.g., "20 years", "until retirement at 65"). Do not use vague terms like "long-term" unless that is the only information available.
- **location**: extract the country or location as stated.
- **knowledgeLevel**: map to ${knowledgeLevels}.
- **brokerage**: extract if mentioned, otherwise default to \`"none"\`.
- **hasEmergencyFund**: \`true\` or \`false\` based on what the user said.
- **hasDebt**: \`true\` or \`false\` based on what the user said.
- **monthlyContribution**: extract the exact number.

# Examples

## Example 1
Conversation: User wants to invest ₪55,000, is 28, moderate risk, plans to invest for about 20 years, Israel-based, beginner, has emergency fund, no debt, ₪1,800/month, no brokerage mentioned.
Output:
- goal: "invest ₪55,000 but have no idea where to begin"
- amount: 55000
- age: 28
- riskTolerance: "moderate"
- timeline: "20 years"
- location: "Israel"
- knowledgeLevel: "beginner"
- brokerage: "none"
- hasEmergencyFund: true
- hasDebt: false
- monthlyContribution: 1800

## Example 2
Conversation: User has ₪180,000 inheritance, is 35, aggressive risk, investing until retirement at 65, lives in Israel, intermediate, no emergency fund, has student debt, can contribute ₪3,500/month, uses Interactive Brokers.
Output:
- goal: "invest ₪180,000 inheritance for retirement"
- amount: 180000
- age: 35
- riskTolerance: "aggressive"
- timeline: "until retirement at 65"
- location: "Israel"
- knowledgeLevel: "intermediate"
- brokerage: "Interactive Brokers"
- hasEmergencyFund: false
- hasDebt: true
- monthlyContribution: 3500`;

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
    model: CLARIFY_MODEL,
    instructions: CLARIFY_SYSTEM_PROMPT,
    input: goal,
    tools,
    reasoning: {
      effort: "low",
    },
  });

  let toolCallCount = 0;

  while (toolCallCount <= MAX_STAGE_TOOL_CALLS) {
    const functionCalls = response.output.filter((item) => item.type === "function_call");

    if (functionCalls.length === 0) break;

    const toolOutputs = [];

    for (const functionCall of functionCalls) {
      if (functionCall.name !== "ask_user") {
        throw new InternalError(`Unexpected tool call: ${functionCall.name}`);
      }

      toolCallCount++;

      if (toolCallCount > MAX_STAGE_TOOL_CALLS) {
        throw new InternalError(
          `Clarify stage failed to converge within ${String(MAX_STAGE_TOOL_CALLS)} tool calls`,
        );
      }

      logger.info("Tool call received", {
        toolCallCount,
        tool: functionCall.name,
        callId: functionCall.call_id,
        arguments: functionCall.arguments,
      });

      const result = await handleAskUser(
        functionCall.arguments,
        sendToUser,
        waitForResponse,
      );

      logger.info("Tool call completed", {
        toolCallCount,
        tool: functionCall.name,
        callId: functionCall.call_id,
        userResponse: result,
      });

      const toolOutput: ResponseInputItem.FunctionCallOutput = {
        type: "function_call_output",
        call_id: functionCall.call_id,
        output: result,
      };
      toolOutputs.push(toolOutput);
    }

    response = await callOpenAI({
      model: CLARIFY_MODEL,
      instructions: CLARIFY_SYSTEM_PROMPT,
      tools,
      previous_response_id: response.id,
      input: toolOutputs,
      reasoning: {
        effort: "low",
      },
    });
  }

  logger.info("Extracting user profile from conversation");

  // previous_response_id carries the full conversation; input: [] avoids duplicating context
  const { output: profile } = await callOpenAIParsed<UserProfile>({
    model: CLARIFY_MODEL,
    instructions: EXTRACTION_SYSTEM_PROMPT,
    input: [],
    previous_response_id: response.id,
    text: {
      format: zodTextFormat(UserProfileSchema, "UserProfileSchema"),
    },
  });

  logger.info("Clarify stage complete", {
    totalToolCalls: toolCallCount,
    profile,
  });

  return profile;
};
