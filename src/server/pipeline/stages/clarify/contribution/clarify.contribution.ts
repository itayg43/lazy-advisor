import { createLogger } from "#lib/logger";
import { askWithClassify, isClassifyError } from "#pipeline/ask-with-classify";
import {
  CONTRIBUTION_QUESTION,
  buildClassifyInstructions,
} from "#pipeline/stages/clarify/contribution/clarify.contribution.prompts";
import {
  ContributionClassifyResolvedSchema,
  ContributionClassifySchema,
} from "#pipeline/stages/clarify/contribution/clarify.contribution.schemas";
import type { ContributionPhaseResult } from "#pipeline/stages/clarify/contribution/clarify.contribution.types";
import type { Responder } from "#pipeline/tools/ask-user.tool";

const logger = createLogger("clarifyContribution");

const askContribution = async (
  equityAmount: number,
  bufferAmount: number,
  responder: Responder,
): Promise<boolean> => {
  try {
    const output = await askWithClassify({
      question: CONTRIBUTION_QUESTION,
      classifyInstructions: buildClassifyInstructions(equityAmount, bufferAmount),
      schema: ContributionClassifySchema,
      resolvedSchema: ContributionClassifyResolvedSchema,
      responder,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 2,
    });

    const plansToContribute = output.answer === "yes";

    logger.debug("askContribution output", { plansToContribute });

    return plansToContribute;
  } catch (error) {
    // Contribution is non-blocking by design — every classify-error mode
    // (follow-ups exhausted, output invalid, message missing) collapses to
    // the safe default. Mirrors ef-debt: "when in doubt, assume no contribution."
    if (isClassifyError(error)) {
      logger.warn("askContribution — classify error, defaulting to no contribution", {
        error: error.name,
      });

      return false;
    }

    throw error;
  }
};

export const collectContribution = async (
  amount: number,
  equityPercentage: number,
  responder: Responder,
): Promise<ContributionPhaseResult> => {
  logger.info("Starting contribution phase", { amount, equityPercentage });

  const equityAmount = Math.round((amount * equityPercentage) / 100);
  const bufferAmount = amount - equityAmount;

  const plansToContribute = await askContribution(equityAmount, bufferAmount, responder);

  const result = { plansToContribute };

  logger.debug("Contribution output", { output: result });

  return result;
};
