import { exhaustiveSwitch } from "#lib/exhaustive-switch";
import { createLogger } from "#lib/logger";
import { runWithSession } from "#lib/session-context";
import { collectAllocation } from "#pipeline/stages/clarify/allocation/clarify.allocation";
import { collectContribution } from "#pipeline/stages/clarify/contribution/clarify.contribution";
import { collectEfDebt } from "#pipeline/stages/clarify/ef-debt/clarify.ef-debt";
import { INTAKE_HANDLERS } from "#pipeline/stages/clarify/intake/clarify.intake.handlers";
import { classifyGoal } from "#pipeline/stages/clarify/intake/classify/clarify.classify";
import { collectParameters } from "#pipeline/stages/clarify/parameters/clarify.parameters";
import { collectRisk } from "#pipeline/stages/clarify/risk/clarify.risk";
import {
  ALLOCATION_EXIT_MESSAGE,
  AMOUNT_EXIT_MESSAGE,
  INTAKE_REJECTION_DEFAULT_MESSAGE,
  INTAKE_REJECTION_MESSAGES,
  PROFILE_TRANSITION_MESSAGE,
  RISK_EXIT_MESSAGE,
  SHORT_TIMELINE_EXIT_MESSAGE,
  TIMELINE_EXIT_MESSAGE,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { TimelineBucket, UserProfileSchema } from "#schemas/pipeline.schemas";
import type { UserProfile } from "#types/pipeline.types";

const logger = createLogger("clarifyStage");

export const runClarifyStage = async (
  sessionId: string,
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<UserProfile | null> => {
  return runWithSession(sessionId, async () => {
    logger.info("Starting clarify stage", { goal });

    const classification = await classifyGoal(goal);

    const handler = INTAKE_HANDLERS[classification];
    if (handler) {
      const result = await handler(goal, sendToUser, waitForResponse);
      if (!result.accepted) {
        logger.info("User rejected intake redirect, ending session");

        sendToUser(
          INTAKE_REJECTION_MESSAGES[classification] ?? INTAKE_REJECTION_DEFAULT_MESSAGE,
        );

        return null;
      }
    }

    sendToUser(PROFILE_TRANSITION_MESSAGE);

    await collectEfDebt(sendToUser, waitForResponse);

    const parametersResult = await collectParameters(sendToUser, waitForResponse);

    if (parametersResult.status === "failure") {
      exhaustiveSwitch(parametersResult.reason, {
        amount_missing: () => sendToUser(AMOUNT_EXIT_MESSAGE),
        timeline_missing: () => sendToUser(TIMELINE_EXIT_MESSAGE),
      });

      return null;
    }

    const { parameters } = parametersResult;

    if (parameters.timeline === TimelineBucket.enum["under 3 years"]) {
      logger.info("Short timeline — exiting pipeline", { timeline: parameters.timeline });

      sendToUser(SHORT_TIMELINE_EXIT_MESSAGE);

      return null;
    }

    const riskResult = await collectRisk(sendToUser, waitForResponse);

    if (riskResult.status === "failure") {
      exhaustiveSwitch(riskResult.reason, {
        risk_missing: () => sendToUser(RISK_EXIT_MESSAGE),
      });

      return null;
    }

    const allocationResult = await collectAllocation(
      parameters,
      riskResult,
      sendToUser,
      waitForResponse,
    );

    if (allocationResult.status === "failure") {
      exhaustiveSwitch(allocationResult.reason, {
        split_unresolved: () => sendToUser(ALLOCATION_EXIT_MESSAGE),
      });

      return null;
    }

    const { allocation } = allocationResult;

    const contribution = await collectContribution(
      parameters,
      allocation,
      sendToUser,
      waitForResponse,
    );

    const profile = {
      ...parameters,
      riskTolerance: riskResult.riskTolerance,
      ...allocation,
      ...contribution,
    };

    logger.info("Clarify stage complete");
    logger.debug("Assembled profile before validation", { profile });

    return UserProfileSchema.parse(profile);
  });
};
