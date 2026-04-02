import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputItem } from "openai/resources/responses/responses";

import { InternalError } from "#server/errors";
import { createLogger } from "#server/lib/logger";
import { getStageTools } from "#server/pipeline/tools";
import {
  handleAskUser,
  type SendToUser,
  type WaitForResponse,
} from "#server/pipeline/tools/ask-user.tool";
import {
  KnowledgeLevel,
  RiskTolerance,
  UserProfileSchema,
} from "#server/schemas/pipeline.schema";
import { callOpenAI, callOpenAIParsed } from "#server/services/openai";
import type { UserProfile } from "#server/types/pipeline.types";

const logger = createLogger("clarifyStage");

const CLARIFY_MODEL = "gpt-5.4-nano";
export const MAX_STAGE_TOOL_CALLS = 10;

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

## Required Fields
Every required field must have a specific, actionable value:
- Investment amount: a specific number. Not \`some money\`, \`a lot\`, or \`not sure\`.
- Age: a specific number.
- Risk tolerance: map the user's description to ${riskLevels}. The user does not need to use these exact terms.
- Investment timeline: a specific number of years or a concrete milestone (e.g., \`5 years\`, \`until retirement at 65\`). Not \`long-term\`, \`short-term\`, \`a while\`, \`eventually\`, or \`until retirement\` without an age. Ranges like \`10-15 years\` ARE specific enough — do not ask the user to narrow further.
- Location or country.
- Knowledge level: map to ${knowledgeLevels} based on what the user describes.
- Emergency fund: yes or no.
- Outstanding debt: yes or no.
- Monthly contribution: a specific number. Not \`whatever I can\` or \`not much\`.
- Investment preferences: specific sectors, markets, or instruments (e.g., \`S&P 500\`, \`tech sector\`, \`Israeli market\`, \`TLV-125\`). If the user has no specific preference, set to \`none\`. Not vague like \`something safe\` or \`good returns\` — either name specific sectors/markets/instruments or \`none\`.

## Optional Fields
- Brokerage preference: default to \`none\` if not mentioned.

# Validation Rules
Before responding, evaluate every required field against the specificity rules above.
- If any field is missing or too vague → call \`ask_user\`.
- If the user has been asked about the same field twice without providing a specific value, accept the best available answer and move on. Do not keep asking.

# Output Format
Return exactly one of:
- A single \`ask_user\` tool call if any field fails validation.
- A short confirmation like "Got it, I have everything I need." if all fields pass.
- Nothing else — no advice, no suggestions, no plans.

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
- investment preferences: not mentioned ✗ — need to ask
Two fields failed → call \`ask_user\`: "When you say long-term, roughly how many years are you thinking — 10, 20, or until retirement at a certain age? Also, do you have any preference for specific sectors, markets, or instruments (e.g., S&P 500, Israeli market, tech sector), or should I just go with a general diversified approach?"

## Example 2 — all fields specific (range timeline is acceptable), done
ask_user returned: "I'm 24, Israel, ₪18,000, moderate risk, 10-15 years, beginner, ₪700/month, no debt, have emergency fund, I'm interested in S&P 500 and Israeli market."
Field evaluation:
- amount: ₪18,000 ✓
- age: 24 ✓
- risk tolerance: moderate ✓
- timeline: "10-15 years" ✓ — a numeric range is specific enough
- location: Israel ✓
- knowledge level: beginner ✓
- emergency fund: yes ✓
- debt: no ✓
- monthly contribution: ₪700 ✓
- investment preferences: "S&P 500 and Israeli market" ✓
All fields passed → respond: "Got it, I have everything I need to build your plan."`;

const EXTRACTION_SYSTEM_PROMPT = `# Role and Objective
You are the extraction stage of an investment advisor pipeline. Your sole responsibility is to extract a structured user profile from the preceding conversation. Do **not** infer, assume, or add information that was not explicitly discussed.

# Instructions
- Extract each field strictly from what the user said in the conversation.
- Stay close to the user's actual words. Do not paraphrase, summarize, or embellish.
- Every required field must have a value extracted from the conversation. If a required field was not discussed, the clarification phase failed — extract the best available information anyway, but do not fabricate values.
- Fields with defaults: **brokerage** (\`"none"\` if not mentioned), **investmentPreferences** (\`"none"\` if not mentioned or user has no specific preference).

# Field Rules
- **goal**: build a concise summary of the user's investment goal using context from the entire conversation — not just their initial input. Include specifics the user mentioned (amounts, purpose, constraints). Do not reduce to generic phrases like "start investing."
- **amount**: extract the exact number. Convert shorthand (e.g., "₪55k" → 55000).
- **age**: extract the exact number.
- **riskTolerance**: map to ${riskLevels} based on what the user described.
- **timeline**: extract the specific timeframe the user stated (e.g., "20 years", "until retirement at 65"). Do not use vague terms like "long-term" unless that is the only information available.
- **location**: extract the country or location as stated.
- **knowledgeLevel**: map to ${knowledgeLevels}.
- **brokerage**: extract if mentioned, otherwise default to \`"none"\`.
- **investmentPreferences**: extract any mentioned sectors, markets, indices, or specific instruments the user wants to invest in. Use the user's own words. Default to \`"none"\` if not mentioned or user has no specific preference.
- **hasEmergencyFund**: \`true\` or \`false\` based on what the user said.
- **hasDebt**: \`true\` or \`false\` based on what the user said.
- **monthlyContribution**: extract the exact number.

# Examples

## Example 1 — beginner with no brokerage, goal enriched from conversation
Conversation: User wants to invest ₪55,000, is 28, moderate risk, plans to invest for about 20 years, Israel-based, beginner, has emergency fund, no debt, ₪1,800/month, no brokerage mentioned.
Output:
- goal: "invest ₪55,000 as a complete beginner, moderate risk, 20-year horizon with ₪1,800/month contributions"
- amount: 55000
- age: 28
- riskTolerance: "moderate"
- timeline: "20 years"
- location: "Israel"
- knowledgeLevel: "beginner"
- brokerage: "none"
- investmentPreferences: "none"
- hasEmergencyFund: true
- hasDebt: false
- monthlyContribution: 1800

## Example 2 — experienced investor with brokerage, goal captures constraints
Conversation: User has ₪180,000 inheritance, is 35, aggressive risk, investing until retirement at 65, lives in Israel, intermediate, no emergency fund, has student debt, can contribute ₪3,500/month, uses Interactive Brokers.
Output:
- goal: "invest ₪180,000 inheritance aggressively until retirement at 65, has student debt and no emergency fund"
- amount: 180000
- age: 35
- riskTolerance: "aggressive"
- timeline: "until retirement at 65"
- location: "Israel"
- knowledgeLevel: "intermediate"
- brokerage: "Interactive Brokers"
- investmentPreferences: "none"
- hasEmergencyFund: false
- hasDebt: true
- monthlyContribution: 3500`;

// Production: pass `input: []` with `previousResponseId` — conversation context is carried
// server-side by OpenAI's response chaining.
// Extraction evals: pass the full conversation as `input` without `previousResponseId` —
// allows testing extraction in isolation with deterministic, handwritten transcripts.
type ExtractionParams = {
  input: ResponseInputItem[];
  previousResponseId?: string;
};

export const extractUserProfile = async (
  params: ExtractionParams,
): Promise<UserProfile> => {
  const extractionResponse = await callOpenAIParsed<UserProfile>({
    model: CLARIFY_MODEL,
    instructions: EXTRACTION_SYSTEM_PROMPT,
    input: params.input,
    ...(params.previousResponseId && { previous_response_id: params.previousResponseId }),
    text: {
      format: zodTextFormat(UserProfileSchema, "UserProfileSchema"),
    },
    reasoning: {
      effort: "low",
    },
  });

  logger.info("Extraction complete", {
    extractionResponseId: extractionResponse.id,
    extractionUsage: extractionResponse.usage,
  });
  logger.debug("Extracted profile", {
    profile: extractionResponse.output,
  });

  return extractionResponse.output;
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
    model: CLARIFY_MODEL,
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

  let toolCallCount = 0;

  // Loop exits on break (model stops calling tools) or throw (tool call cap exceeded)
  while (true) {
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
          `Clarify stage failed to converge within ${MAX_STAGE_TOOL_CALLS} tool calls`,
        );
      }

      logger.info("Tool call received", {
        toolCallCount,
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
        toolCallCount,
        tool: functionCall.name,
        callId: functionCall.call_id,
      });
      logger.debug("User response", {
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

    logger.info("Clarify follow-up response", {
      responseId: response.id,
      usage: response.usage,
    });
  }

  logger.info("Clarification complete, starting extraction", {
    lastResponseId: response.id,
  });

  const profile = await extractUserProfile({
    input: [],
    previousResponseId: response.id,
  });

  logger.info("Clarify stage complete", {
    totalToolCalls: toolCallCount,
  });

  return profile;
};
