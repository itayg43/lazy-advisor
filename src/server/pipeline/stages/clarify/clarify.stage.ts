import { createLogger } from "#lib/logger";
import { collectAllocation } from "#pipeline/stages/clarify/allocation/clarify.allocation";
import { collectContribution } from "#pipeline/stages/clarify/contribution/clarify.contribution";
import { collectEfDebt } from "#pipeline/stages/clarify/ef-debt/clarify.ef-debt";
import { INTAKE_HANDLERS } from "#pipeline/stages/clarify/intake/clarify.intake.handlers";
import { classifyGoal } from "#pipeline/stages/clarify/intake/classify/clarify.classify";
import { collectParameters } from "#pipeline/stages/clarify/parameters/clarify.parameters";
import { collectRisk } from "#pipeline/stages/clarify/risk/clarify.risk";
import {
  PROFILE_TRANSITION_MESSAGE,
  SHORT_TIMELINE_BUCKET,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import {
  ClarifyHaltReasonEnum,
  GoalClassificationEnum,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { ClarifyStageResult } from "#pipeline/stages/clarify/shared/clarify.types";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum, UserProfileSchema } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyStage");

export const runClarifyStage = async (
  goal: string,
  responder: Responder,
): Promise<ClarifyStageResult> => {
  logger.info("Starting clarify stage", { goal });

  const classification = await classifyGoal(goal);

  if (classification !== GoalClassificationEnum.enum.normal) {
    const handler = INTAKE_HANDLERS[classification];
    const result = await handler(goal, responder);
    if (!result.accepted) {
      logger.info("User rejected intake redirect, ending session");

      return {
        status: PipelineStatusEnum.enum.halted,
        reason: ClarifyHaltReasonEnum.enum.intake_rejected,
        classification,
      };
    }
  }

  responder.sendToUser(PROFILE_TRANSITION_MESSAGE);

  await collectEfDebt(responder);

  const parametersResult = await collectParameters(responder);
  if (parametersResult.status !== PipelineStatusEnum.enum.completed) {
    return parametersResult;
  }

  const { amount, timeline } = parametersResult;

  if (timeline === SHORT_TIMELINE_BUCKET) {
    logger.info("Short timeline — halting pipeline", { timeline });

    return {
      status: PipelineStatusEnum.enum.halted,
      reason: ClarifyHaltReasonEnum.enum.short_timeline,
    };
  }

  const riskResult = await collectRisk(responder);
  if (riskResult.status !== PipelineStatusEnum.enum.completed) {
    return riskResult;
  }

  const { riskTolerance } = riskResult;

  const allocationResult = await collectAllocation(
    amount,
    timeline,
    riskTolerance,
    responder,
  );
  if (allocationResult.status !== PipelineStatusEnum.enum.completed) {
    return allocationResult;
  }

  const { equityPercentage, bufferPercentage } = allocationResult;

  const contributionResult = await collectContribution(
    amount,
    equityPercentage,
    responder,
  );

  const { plansToContribute } = contributionResult;

  const profile = UserProfileSchema.parse({
    amount,
    timeline,
    riskTolerance,
    equityPercentage,
    bufferPercentage,
    plansToContribute,
  });

  logger.info("Clarify stage complete");
  logger.debug("Profile output", { profile });

  return { status: PipelineStatusEnum.enum.completed, profile };
};
