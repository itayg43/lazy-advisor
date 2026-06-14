import type { EasyInputMessage } from "openai/resources/responses/responses";

import { createLogger } from "#lib/logger";
import {
  calculateBufferPercentage,
  computeSplit,
  formatCurrency,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.lib";
import {
  ALLOCATION_CLASSIFIER_PROMPT,
  ALLOCATION_COUNTER_COMPOSER_PROMPT,
  ALLOCATION_QUESTION_COMPOSER_PROMPT,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.prompts";
import {
  AllocationClassifierOutputSchema,
  AllocationComposerOutputSchema,
  AllocationCounterBranchKindEnum,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type {
  AllocationClassifierOutput,
  AllocationCounterBranch,
  AllocationProposalContext,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import { callOpenAIParsed } from "#services/openai";

// Model-IO layer for the allocation phase: every OpenAI call lives here, so the
// main file holds turn-decision logic and the runner wiring, and `.lib` stays
// pure. These functions own their prompts/schemas and log each call.
const logger = createLogger("clarifyAllocationIO");

export const classifyTurn = async (
  history: ReadonlyArray<EasyInputMessage>,
): Promise<AllocationClassifierOutput> => {
  const { id, output } = await callOpenAIParsed(
    {
      model: "gpt-5.4-nano",
      instructions: ALLOCATION_CLASSIFIER_PROMPT,
      // Spread to strip readonly — SDK's input field expects a mutable array.
      input: [...history],
      reasoning: { effort: "low" },
    },
    AllocationClassifierOutputSchema,
  );

  logger.info("Classified turn", {
    responseId: id,
    ...output,
  });

  return output;
};

const composeReply = async (instructions: string, input: string): Promise<string> => {
  const {
    output: { reply },
  } = await callOpenAIParsed(
    {
      model: "gpt-5.4-nano",
      instructions,
      input,
      reasoning: { effort: "low" },
    },
    AllocationComposerOutputSchema,
  );

  return reply;
};

export const composeCounterReply = async (
  counterBranch: AllocationCounterBranch,
  equityPercentages: {
    proposedEquityPercentage: number;
    previousEquityPercentage: number;
  },
  proposalContext: AllocationProposalContext,
): Promise<string> => {
  const { proposedEquityPercentage, previousEquityPercentage } = equityPercentages;

  const proposedBufferPercentage = calculateBufferPercentage(proposedEquityPercentage);
  const { equityAmount, bufferAmount } = computeSplit(
    proposalContext.amount,
    proposedEquityPercentage,
  );

  const branchTag =
    counterBranch.kind === AllocationCounterBranchKindEnum.enum.extreme
      ? `extreme-${counterBranch.direction}`
      : counterBranch.kind;

  const input = `Branch to render: ${branchTag}
User's exact equity proposal: ${proposedEquityPercentage}% (buffer ${proposedBufferPercentage}%)
Previous equity in conversation: ${previousEquityPercentage}%
Investment amount: ${formatCurrency(proposalContext.amount)}
New split in shekels: ${formatCurrency(equityAmount)} in stock ETFs, ${formatCurrency(bufferAmount)} in buffer
Investment timeline: ${proposalContext.timeline}
Recommended range: ${proposalContext.suggestedEquityRange.min}–${proposalContext.suggestedEquityRange.max}% equity`;

  const reply = await composeReply(ALLOCATION_COUNTER_COMPOSER_PROMPT, input);

  logger.info("Composed counter reply", { reply });

  return reply;
};

export const composeQuestionReply = async (
  question: string,
  currentEquityPercentage: number,
  proposalContext: AllocationProposalContext,
): Promise<string> => {
  const bufferPercentage = calculateBufferPercentage(currentEquityPercentage);
  const { equityAmount, bufferAmount } = computeSplit(
    proposalContext.amount,
    currentEquityPercentage,
  );

  const input = `Current proposal: ${formatCurrency(equityAmount)} in stock ETFs, ${formatCurrency(bufferAmount)} in buffer (${currentEquityPercentage}/${bufferPercentage})
Investment amount: ${formatCurrency(proposalContext.amount)}
Investment timeline: ${proposalContext.timeline}
Recommended range: ${proposalContext.suggestedEquityRange.min}–${proposalContext.suggestedEquityRange.max}% equity
User's question: ${question}`;

  const reply = await composeReply(ALLOCATION_QUESTION_COMPOSER_PROMPT, input);

  logger.info("Composed question reply", { reply });

  return reply;
};
