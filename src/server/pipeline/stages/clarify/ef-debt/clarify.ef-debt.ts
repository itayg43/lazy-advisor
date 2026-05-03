import { z } from "zod";

import { createLogger } from "#lib/logger";
import {
  AskWithClassifyBaseSchema,
  askWithClassify,
} from "#pipeline/stages/clarify/shared/clarify.ask";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

const logger = createLogger("clarifyEfDebt");

const EmergencyFundSchema = AskWithClassifyBaseSchema.extend({
  answer: z.enum(["yes", "no"]).nullable(),
});

const DebtSchema = AskWithClassifyBaseSchema.extend({
  answer: z.enum(["yes", "no"]).nullable(),
});

const EF_QUESTION =
  "Do you have an emergency fund (3–6 months of living expenses set aside in a liquid account)?";

const DEBT_QUESTION =
  "Do you have any significant high-interest debt, such as credit card balances or personal loans? (A mortgage doesn't count here.)";

const EF_EDUCATION =
  "An unexpected expense could force you to sell investments at a bad time — possibly at a loss. Standard guidance is 3–6 months of expenses in a liquid account before investing.";

const DEBT_EDUCATION =
  "High-interest debt (e.g., credit cards at 15–25% APR) typically costs more than ETF investing earns (~7–10% per year). Paying it off first often yields a better net return.";

const EF_CLASSIFY_INSTRUCTIONS = `
# Role and Objective
You are classifying a user's response to: "${EF_QUESTION}"
Populate the three output fields based on the rules below.

# Output Rules

**answer**
- "yes" — user confirmed they have an emergency fund
- "no"  — user confirmed they do not
- null  — when clarificationNeeded is true

**clarificationNeeded**
- true — user asked a question instead of answering (e.g. "what counts as one?", "does a savings account qualify?")
- true — user gave an ambiguous or unclear answer (e.g. "I have some savings", "I think so?")
- true — user deflected or went off-topic (e.g. "skip this", "I don't want to answer")
- true — user both answered and asked a question (e.g. "Yes, but does a savings account count?") — answer the question first; the answer will be re-confirmed next turn
- false — user gave a clear yes or no

**clarificationMessage** (only when clarificationNeeded is true)
- Must be non-null when clarificationNeeded is true.
- Use the conversation history to understand exactly what the user said or asked — tailor your response accordingly.
- If user asked a question: answer it directly using the key facts below
- If user gave an ambiguous answer: ask them to clarify (e.g. "Could you be more specific — do you have 3–6 months of expenses set aside in a savings or checking account?")
- If user deflected or went off-topic: redirect them back (e.g. "I need your answer to continue — do you have an emergency fund?")
- If user both answered and asked a question: answer their question first
- Key facts: an emergency fund is 3–6 months of living expenses in a liquid, accessible account (e.g. savings or checking). Retirement accounts, investments, or illiquid assets do not qualify.
- Keep it to 1–2 sentences. Do not re-state the original question.
`;

const DEBT_CLASSIFY_INSTRUCTIONS = `
# Role and Objective
You are classifying a user's response to: "${DEBT_QUESTION}"
Populate the three output fields based on the rules below.

# Output Rules

**answer**
- "yes" — user confirmed they have high-interest debt
- "no"  — user confirmed they do not
- null  — when clarificationNeeded is true

**clarificationNeeded**
- true — user asked a question instead of answering (e.g. "does my mortgage count?", "what qualifies as high-interest?")
- true — user gave an ambiguous or unclear answer (e.g. "I have some debt", "kind of?")
- true — user deflected or went off-topic (e.g. "skip this", "I don't want to answer")
- true — user both answered and asked a question (e.g. "No, but does my mortgage count?") — answer the question first; the answer will be re-confirmed next turn
- false — user gave a clear yes or no

**clarificationMessage** (only when clarificationNeeded is true)
- Must be non-null when clarificationNeeded is true.
- Use the conversation history to understand exactly what the user said or asked — tailor your response accordingly.
- If user asked a question: answer it directly using the key facts below
- If user gave an ambiguous answer: ask them to clarify (e.g. "Could you be more specific — do you have credit card balances or personal loans with high APR?")
- If user deflected or went off-topic: redirect them back (e.g. "I need your answer to continue — do you have significant high-interest debt like credit card balances?")
- If user both answered and asked a question: answer their question first
- Key facts: high-interest debt means credit card balances, personal loans, or similar at 15–25%+ APR. Mortgages do not count.
- Keep it to 1–2 sentences. Do not re-state the original question.
`;

const askEmergencyFund = async (
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<boolean> => {
  const result = await askWithClassify({
    question: EF_QUESTION,
    classifyInstructions: EF_CLASSIFY_INSTRUCTIONS,
    schema: EmergencyFundSchema,
    sendToUser,
    waitForResponse,
    model: "gpt-5.4-nano",
    effort: "low",
  });

  if (result.status === "failure") return false;

  return result.output.answer === "yes";
};

const askDebt = async (
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<boolean> => {
  const result = await askWithClassify({
    question: DEBT_QUESTION,
    classifyInstructions: DEBT_CLASSIFY_INSTRUCTIONS,
    schema: DebtSchema,
    sendToUser,
    waitForResponse,
    model: "gpt-5.4-nano",
    effort: "low",
  });

  if (result.status === "failure") return true;

  return result.output.answer === "yes";
};

export const collectEfDebt = async (
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<void> => {
  logger.info("Starting EF/debt phase");

  const hasEF = await askEmergencyFund(sendToUser, waitForResponse);
  const hasDebt = await askDebt(sendToUser, waitForResponse);

  if (hasEF && !hasDebt) {
    logger.info("EF/debt phase complete — no education needed");

    return;
  }

  const educationParts: string[] = [];
  if (!hasEF) educationParts.push(EF_EDUCATION);
  if (hasDebt) educationParts.push(DEBT_EDUCATION);

  sendToUser(educationParts.join("\n\n"));

  logger.info("EF/debt phase complete");
};
