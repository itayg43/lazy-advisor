import { z } from "zod";

import { createLogger } from "#lib/logger";
import {
  AskWithClassifyBaseSchema,
  ClassifyFollowUpsExhaustedError,
  askWithClassify,
  mapClassifyErrorToErrored,
} from "#pipeline/stages/clarify/shared/clarify.ask";
import type {
  AllocationPhaseOutput,
  ContributionPhaseResult,
  ParametersPhaseOutput,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyContribution");

const ContributionClassifySchema = AskWithClassifyBaseSchema.extend({
  answer: z.enum(["yes", "no"]).nullable(),
});

const ContributionClassifyResolvedSchema = ContributionClassifySchema.extend({
  answer: z.enum(["yes", "no"]),
});

export type ContributionClassify = z.infer<typeof ContributionClassifySchema>;

const CONTRIBUTION_QUESTION =
  "After your initial investment, do you plan to add money to your portfolio periodically — for example, every month or quarter?";

const buildClassifyInstructions = (equityAmount: number, bufferAmount: number): string =>
  `# Role and Objective
You are classifying a user's response to: "${CONTRIBUTION_QUESTION}"
Populate the three output fields based on the rules below.

Context — the user's investment split:
- Equity: ₪${equityAmount.toLocaleString()}
- Buffer: ₪${bufferAmount.toLocaleString()}

# Output Rules

**answer**
- "yes" — user confirmed they plan to contribute periodically
- "no" — user confirmed they will not, OR gave a vague/uncertain answer (not sure, maybe, I don't know, etc.)
- null  — when clarificationNeeded is true

**clarificationNeeded**
- true — user asked what "periodically" or DCA means
- true — user raised an Israel-specific constraint (fractional shares, small amounts, brokerage minimums)
- true — user gave an answer but also asked a follow-up question
- false — user gave a clear yes or no
- false — user gave a vague or uncertain answer (resolve as "no" directly)

**clarificationMessage** (only when clarificationNeeded is true)
- Must be non-null when clarificationNeeded is true.
- Use the conversation history to understand what the user said — tailor your response accordingly.
- If user asked what DCA or periodic contributing means: explain in 2 sentences. Sentence 1: mechanics referencing their equity amount (e.g. "It means adding a fixed amount to your ₪${equityAmount.toLocaleString()} equity position every month or quarter."). Sentence 2: benefit (buy more units when prices are low, smoothing out market swings). Then re-ask.
- If user raised Israel/fractional concerns: explain that the real constraint is fractional shares (Israeli brokerages don't support fractional ETF units — need enough to buy at least one full unit at a time); fees are not a real barrier (a few shekels per trade); the practical workaround is accumulating savings and investing quarterly. Reference their equity (₪${equityAmount.toLocaleString()}) and buffer (₪${bufferAmount.toLocaleString()}) amounts. Then re-ask. Keep to 3–4 sentences.
- Keep it direct. Do not re-state the original question.

# Examples

User: "yes"
→ clarificationNeeded: false, answer: "yes"
User: "no, one-time only"
→ clarificationNeeded: false, answer: "no"
User: "maybe someday"
→ clarificationNeeded: false, answer: "no" (vague — resolve directly)
User: "what does periodically mean?"
→ clarificationNeeded: true — explain DCA mechanics with their equity amount, then re-ask
User: "in Israel you can't buy partial shares so it's hard to add small amounts"
→ clarificationNeeded: true — explain fractional shares constraint and quarterly workaround, include their equity/buffer amounts, then re-ask`;

export const collectContribution = async (
  parameters: ParametersPhaseOutput,
  allocation: AllocationPhaseOutput,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<ContributionPhaseResult> => {
  logger.info("Starting contribution phase", { parameters, allocation });

  const equityAmount = Math.round(
    (parameters.amount * allocation.equityPercentage) / 100,
  );
  const bufferAmount = parameters.amount - equityAmount;

  try {
    const output = await askWithClassify({
      question: CONTRIBUTION_QUESTION,
      classifyInstructions: buildClassifyInstructions(equityAmount, bufferAmount),
      schema: ContributionClassifySchema,
      resolvedSchema: ContributionClassifyResolvedSchema,
      sendToUser,
      waitForResponse,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 2,
    });

    const result = {
      status: PipelineStatusEnum.enum.completed,
      plansToContribute: output.answer === "yes",
    } as const;

    logger.debug("Contribution output", { output: result });

    return result;
  } catch (error) {
    if (error instanceof ClassifyFollowUpsExhaustedError) {
      logger.warn(
        "collectContribution — follow-ups exhausted, defaulting to no contribution",
      );

      return { status: PipelineStatusEnum.enum.completed, plansToContribute: false };
    }

    const errored = mapClassifyErrorToErrored(error, "collectContribution");
    if (errored) return errored;

    throw error;
  }
};
