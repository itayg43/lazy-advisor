import { createLogger } from "#lib/logger";
import { collectAllocation } from "#pipeline/stages/clarify/allocation/clarify.allocation";
import { collectContribution } from "#pipeline/stages/clarify/contribution/clarify.contribution";
import { collectEfDebt } from "#pipeline/stages/clarify/ef-debt/clarify.ef-debt";
import { INTAKE_HANDLERS } from "#pipeline/stages/clarify/intake/clarify.intake.handlers";
import { classifyGoal } from "#pipeline/stages/clarify/intake/classify/clarify.classify";
import { collectParameters } from "#pipeline/stages/clarify/parameters/clarify.parameters";
import { collectRisk } from "#pipeline/stages/clarify/risk/clarify.risk";
import { PROFILE_TRANSITION_MESSAGE } from "#pipeline/stages/clarify/shared/clarify.constants";
import {
  ClarifyHaltReasonEnum,
  GoalClassificationEnum,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { ClarifyStageResult } from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import {
  PipelineStatusEnum,
  TimelineBucketEnum,
  UserProfileSchema,
} from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyStage");

export const runClarifyStage = async (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<ClarifyStageResult> => {
  logger.info("Starting clarify stage", { goal });

  const classification = await classifyGoal(goal);

  if (classification !== GoalClassificationEnum.enum.normal) {
    const handler = INTAKE_HANDLERS[classification];
    const result = await handler(goal, sendToUser, waitForResponse);
    if (!result.accepted) {
      logger.info("User rejected intake redirect, ending session");

      return {
        status: PipelineStatusEnum.enum.halted,
        reason: ClarifyHaltReasonEnum.enum.intake_rejected,
        classification,
      };
    }
  }

  sendToUser(PROFILE_TRANSITION_MESSAGE);

  await collectEfDebt(sendToUser, waitForResponse);

  const parametersResult = await collectParameters(sendToUser, waitForResponse);
  if (parametersResult.status !== PipelineStatusEnum.enum.completed) {
    return parametersResult;
  }
  const { parameters } = parametersResult;

  if (parameters.timeline === TimelineBucketEnum.enum["under 3 years"]) {
    logger.info("Short timeline — halting pipeline", { timeline: parameters.timeline });

    return {
      status: PipelineStatusEnum.enum.halted,
      reason: ClarifyHaltReasonEnum.enum.short_timeline,
    };
  }

  const riskResult = await collectRisk(sendToUser, waitForResponse);
  if (riskResult.status !== PipelineStatusEnum.enum.completed) {
    return riskResult;
  }

  const allocationResult = await collectAllocation(
    parameters,
    riskResult,
    sendToUser,
    waitForResponse,
  );
  if (allocationResult.status !== PipelineStatusEnum.enum.completed) {
    return allocationResult;
  }
  const { allocation } = allocationResult;

  const contribution = await collectContribution(
    parameters,
    allocation,
    sendToUser,
    waitForResponse,
  );

  const profile = UserProfileSchema.parse({
    ...parameters,
    riskTolerance: riskResult.riskTolerance,
    ...allocation,
    ...contribution,
  });

  logger.info("Clarify stage complete");

  return { status: PipelineStatusEnum.enum.completed, profile };
};
