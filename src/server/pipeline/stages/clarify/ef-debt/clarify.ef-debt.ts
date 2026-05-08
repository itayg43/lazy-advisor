import { z } from "zod";

import { exhaustiveSwitch } from "#lib/exhaustive-switch";
import { createLogger } from "#lib/logger";
import {
  AskWithClassifyBaseSchema,
  askWithClassify,
  buildClassifyInstructions,
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

const EF_CLASSIFY_INSTRUCTIONS = buildClassifyInstructions({
  question: EF_QUESTION,
  answerOptions: [
    { value: "yes", description: "user confirmed they have an emergency fund" },
    { value: "no", description: "user confirmed they do not" },
  ],
  keyFacts:
    "An emergency fund is 3–6 months of living expenses in a liquid, accessible account (e.g. savings or checking). Retirement accounts, investments, or illiquid assets do not qualify.",
  examples: [
    {
      userInput: "what counts as an emergency fund?",
      clarificationNeeded: true,
      note: 'answer using key facts (e.g. "An emergency fund is 3–6 months of expenses in a savings or checking account.")',
    },
    {
      userInput: "I have some savings",
      clarificationNeeded: true,
      note: 'ask for specifics (e.g. "Do you have roughly 3–6 months of living expenses set aside in a liquid account?")',
    },
    {
      userInput: "Yes, but does a savings account count?",
      clarificationNeeded: true,
      note: 'answer their question first, then confirm (e.g. "Yes, a savings account qualifies. Just to confirm — you have 3–6 months of expenses set aside?")',
    },
    {
      userInput: "skip this",
      clarificationNeeded: true,
      note: 'redirect directly (e.g. "I need your answer to continue — do you have 3–6 months of expenses set aside in a liquid account?")',
    },
    {
      userInput: "Yes",
      clarificationNeeded: false,
      note: "clear answer, no clarification needed",
    },
  ],
});

const DEBT_CLASSIFY_INSTRUCTIONS = buildClassifyInstructions({
  question: DEBT_QUESTION,
  answerOptions: [
    { value: "yes", description: "user confirmed they have high-interest debt" },
    { value: "no", description: "user confirmed they do not" },
  ],
  keyFacts:
    "High-interest debt means credit card balances, personal loans, or similar at 15–25%+ APR. Mortgages do not count.",
  examples: [
    {
      userInput: "does my mortgage count?",
      clarificationNeeded: true,
      note: "answer using key facts (e.g. \"Mortgages don't count here — I'm asking about high-interest debt like credit card balances or personal loans.\")",
    },
    {
      userInput: "I have some debt",
      clarificationNeeded: true,
      note: 'ask for specifics (e.g. "Do you have credit card balances or personal loans with high interest rates, like 15% APR or more?")',
    },
    {
      userInput: "No, but does my car loan count?",
      clarificationNeeded: true,
      note: 'answer their question first, then confirm (e.g. "A car loan typically doesn\'t count unless the rate is very high. Just to confirm — no high-interest debt like credit cards?")',
    },
    {
      userInput: "I don't want to answer that",
      clarificationNeeded: true,
      note: 'redirect directly (e.g. "I need your answer to continue — do you have significant high-interest debt like credit card balances?")',
    },
    {
      userInput: "No",
      clarificationNeeded: false,
      note: "clear answer, no clarification needed",
    },
  ],
});

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

  if (result.status === "failure") {
    // Intentional: default to no EF → education sent. When in doubt, educate.
    return exhaustiveSwitch(result.code, {
      retries_exhausted: () => false,
    });
  }

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

  if (result.status === "failure") {
    // Intentional: default to has debt → education sent. When in doubt, educate.
    return exhaustiveSwitch(result.code, {
      retries_exhausted: () => true,
    });
  }

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
