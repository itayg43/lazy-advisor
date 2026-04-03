import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputItem } from "openai/resources/responses/responses";

import { createLogger } from "#lib/logger";
import {
  KNOWLEDGE_LEVELS,
  RISK_LEVELS,
} from "#pipeline/stages/clarify/clarify.constants";
import { UserProfileSchema } from "#schemas/pipeline.schema";
import { callOpenAIParsed } from "#services/openai";
import type { UserProfile } from "#types/pipeline.types";

const logger = createLogger("clarifyExtraction");

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
- **riskTolerance**: map to ${RISK_LEVELS} based on what the user described.
- **timeline**: extract the specific timeframe the user stated (e.g., "20 years", "until retirement at 65"). Do not use vague terms like "long-term" unless that is the only information available.
- **location**: extract the country or location as stated.
- **knowledgeLevel**: map to ${KNOWLEDGE_LEVELS}.
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
export type ExtractionParams = {
  input: ResponseInputItem[];
  previousResponseId?: string;
};

export const extractUserProfile = async ({
  input,
  previousResponseId,
}: ExtractionParams): Promise<UserProfile> => {
  const { id, usage, output } = await callOpenAIParsed<UserProfile>({
    model: "gpt-5.4-nano",
    instructions: EXTRACTION_SYSTEM_PROMPT,
    input,
    ...(previousResponseId && {
      previous_response_id: previousResponseId,
    }),
    text: {
      format: zodTextFormat(UserProfileSchema, "UserProfileSchema"),
    },
    reasoning: {
      effort: "low",
    },
  });

  logger.info("Extraction complete", {
    responseId: id,
    usage,
  });
  logger.debug("Extracted profile", {
    profile: output,
  });

  return output;
};
