import { z } from "zod";

import { createLogger } from "#lib/logger";
import {
  AskWithClassifyBaseSchema,
  ConvergenceFailedError,
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

export type EmergencyFundClassify = z.infer<typeof EmergencyFundSchema>;
export type DebtClassify = z.infer<typeof DebtSchema>;

const EF_QUESTION =
  "Do you have an emergency fund (3–6 months of living expenses set aside in a liquid account)?";

const DEBT_QUESTION =
  "Do you have any significant high-interest debt, such as credit card balances or personal loans? (A mortgage doesn't count here.)";

const EF_EDUCATION =
  "An unexpected expense could force you to sell investments at a bad time — possibly at a loss. Standard guidance is 3–6 months of expenses in a liquid account before investing.";

const DEBT_EDUCATION =
  "High-interest debt (e.g., credit cards at 15–25% APR) typically costs more than ETF investing earns (~7–10% per year). Paying it off first often yields a better net return.";

const EF_CLASSIFY_INSTRUCTIONS = `# Role and Objective
You are classifying a user's response to: "${EF_QUESTION}"
Populate the three output fields based on the rules below.

# Output Rules

**answer**
- "yes" — user confirmed they have an emergency fund
- "no" — user confirmed they do not
- null  — when clarificationNeeded is true

**clarificationNeeded**
- true — user asked a question instead of answering (e.g. "what does that mean?", "can you explain?")
- true — user gave an ambiguous or unclear answer (e.g. "I have some savings", "kind of?")
- true — user deflected or went off-topic (e.g. "skip this", "I don't want to answer")
- true — user gave an answer but also asked a follow-up question (e.g. "Yes, but does X count?")
- false — user gave a clear yes or no

**clarificationMessage** (only when clarificationNeeded is true)
- Must be non-null when clarificationNeeded is true.
- Use the conversation history to understand what the user said or asked — tailor your response accordingly.
- If user asked a question: answer it directly using the key facts below
- If user gave an ambiguous answer: ask them to clarify
- If user deflected or went off-topic: redirect them back to the question
- If user gave an answer but also asked a question: answer their question first, then ask them to confirm their answer
- Key facts: An emergency fund is 3–6 months of living expenses in a liquid, accessible account (e.g. savings or checking). Retirement accounts, investments, or illiquid assets do not qualify.
- Keep it to 1–2 sentences. Do not re-state the original question.

# Examples

User: "what counts as an emergency fund?"
→ clarificationNeeded: true — answer using key facts (e.g. "An emergency fund is 3–6 months of expenses in a savings or checking account.")
User: "I have some savings"
→ clarificationNeeded: true — ask for specifics (e.g. "Do you have roughly 3–6 months of living expenses set aside in a liquid account?")
User: "Yes, but does a savings account count?"
→ clarificationNeeded: true — answer their question first, then confirm (e.g. "Yes, a savings account qualifies. Just to confirm — you have 3–6 months of expenses set aside?")
User: "skip this"
→ clarificationNeeded: true — redirect directly (e.g. "I need your answer to continue — do you have 3–6 months of expenses set aside in a liquid account?")
User: "Yes"
→ clarificationNeeded: false — clear answer, no clarification needed`;

const DEBT_CLASSIFY_INSTRUCTIONS = `# Role and Objective
You are classifying a user's response to: "${DEBT_QUESTION}"
Populate the three output fields based on the rules below.

# Output Rules

**answer**
- "yes" — user confirmed they have high-interest debt
- "no" — user confirmed they do not
- null  — when clarificationNeeded is true

**clarificationNeeded**
- true — user asked a question instead of answering (e.g. "what does that mean?", "can you explain?")
- true — user gave an ambiguous or unclear answer (e.g. "I have some savings", "kind of?")
- true — user deflected or went off-topic (e.g. "skip this", "I don't want to answer")
- true — user gave an answer but also asked a follow-up question (e.g. "Yes, but does X count?")
- false — user gave a clear yes or no

**clarificationMessage** (only when clarificationNeeded is true)
- Must be non-null when clarificationNeeded is true.
- Use the conversation history to understand what the user said or asked — tailor your response accordingly.
- If user asked a question: answer it directly using the key facts below
- If user gave an ambiguous answer: ask them to clarify
- If user deflected or went off-topic: redirect them back to the question
- If user gave an answer but also asked a question: answer their question first, then ask them to confirm their answer
- Key facts: High-interest debt means credit card balances, personal loans, or similar at 15–25%+ APR. Mortgages do not count.
- Keep it to 1–2 sentences. Do not re-state the original question.

# Examples

User: "does my mortgage count?"
→ clarificationNeeded: true — answer using key facts (e.g. "Mortgages don't count here — I'm asking about high-interest debt like credit card balances or personal loans.")
User: "I have some debt"
→ clarificationNeeded: true — ask for specifics (e.g. "Do you have credit card balances or personal loans with high interest rates, like 15% APR or more?")
User: "No, but does my car loan count?"
→ clarificationNeeded: true — answer their question first, then confirm (e.g. "A car loan typically doesn't count unless the rate is very high. Just to confirm — no high-interest debt like credit cards?")
User: "I don't want to answer that"
→ clarificationNeeded: true — redirect directly (e.g. "I need your answer to continue — do you have significant high-interest debt like credit card balances?")
User: "No"
→ clarificationNeeded: false — clear answer, no clarification needed`;

const askEmergencyFund = async (
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<boolean> => {
  try {
    const output = await askWithClassify({
      question: EF_QUESTION,
      classifyInstructions: EF_CLASSIFY_INSTRUCTIONS,
      schema: EmergencyFundSchema,
      sendToUser,
      waitForResponse,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 2,
    });

    return output.answer === "yes";
  } catch (err) {
    if (err instanceof ConvergenceFailedError) {
      // Intentional: default to no EF → education sent. When in doubt, educate.
      return false;
    }

    throw err;
  }
};

const askDebt = async (
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<boolean> => {
  try {
    const output = await askWithClassify({
      question: DEBT_QUESTION,
      classifyInstructions: DEBT_CLASSIFY_INSTRUCTIONS,
      schema: DebtSchema,
      sendToUser,
      waitForResponse,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 2,
    });

    return output.answer === "yes";
  } catch (err) {
    if (err instanceof ConvergenceFailedError) {
      // Intentional: default to has debt → education sent. When in doubt, educate.
      return true;
    }

    throw err;
  }
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
