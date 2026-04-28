import { createLogger } from "#lib/logger";
import { collectAllocation } from "#pipeline/stages/clarify/allocation/clarify.allocation";
import { collectContribution } from "#pipeline/stages/clarify/contribution/clarify.contribution";
import { collectFields } from "#pipeline/stages/clarify/fields/clarify.fields";
import { INTAKE_HANDLERS } from "#pipeline/stages/clarify/intake/clarify.intake.handlers";
import { classifyGoal } from "#pipeline/stages/clarify/intake/classify/clarify.classify";
import { collectRisk } from "#pipeline/stages/clarify/risk/clarify.risk";
import {
  INTAKE_REJECTION_DEFAULT_MESSAGE,
  INTAKE_REJECTION_MESSAGES,
  PROFILE_TRANSITION_MESSAGE,
  SHORT_TIMELINE_EXIT_MESSAGE,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { TimelineBucket, UserProfileSchema } from "#schemas/pipeline.schemas";
import type { UserProfile } from "#types/pipeline.types";

const logger = createLogger("clarifyStage");

export const runClarifyStage = async (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<UserProfile | null> => {
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

  const fields = await collectFields(sendToUser, waitForResponse);

  if (fields.timeline === TimelineBucket.enum["under 3 years"]) {
    logger.info("Short timeline — exiting pipeline", { timeline: fields.timeline });

    sendToUser(SHORT_TIMELINE_EXIT_MESSAGE);

    return null;
  }

  const risk = await collectRisk(fields, sendToUser, waitForResponse);
  const allocation = await collectAllocation(fields, risk, sendToUser, waitForResponse);
  const contribution = await collectContribution(
    fields,
    allocation,
    sendToUser,
    waitForResponse,
  );

  const profile = {
    ...fields,
    riskTolerance: risk.riskTolerance,
    ...allocation,
    ...contribution,
  };

  logger.info("Clarify stage complete");
  logger.debug("Assembled profile before validation", { profile });

  return UserProfileSchema.parse(profile);
};
