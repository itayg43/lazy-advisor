import { createLogger } from "#lib/logger";
import type { PhaseSourceParams } from "#pipeline/lib/build-source-params";
import {
  INTAKE_REJECTION_DEFAULT_MESSAGE,
  INTAKE_REJECTION_MESSAGES,
} from "#pipeline/stages/clarify/clarify.constants";
import { GoalClassification } from "#pipeline/stages/clarify/clarify.schemas";
import { extractUserProfile } from "#pipeline/stages/clarify/extraction/clarify.extraction";
import { collectFields } from "#pipeline/stages/clarify/fields/clarify.fields";
import { classifyGoal } from "#pipeline/stages/clarify/intake/clarify.classify";
import { handleContradictoryRisk } from "#pipeline/stages/clarify/intake/clarify.contradictory";
import type { IntakeResult } from "#pipeline/stages/clarify/intake/clarify.intake.lib";
import { handleOutOfScopeRedirect } from "#pipeline/stages/clarify/intake/clarify.out-of-scope";
import { handleUnrealisticExpectations } from "#pipeline/stages/clarify/intake/clarify.unrealistic";
import { collectPreferences } from "#pipeline/stages/clarify/preferences/clarify.preferences";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import type { UserProfile } from "#types/pipeline.types";

const logger = createLogger("clarifyStage");

type IntakeHandler = (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
) => Promise<IntakeResult>;

const INTAKE_HANDLERS: Partial<
  Record<(typeof GoalClassification.options)[number], IntakeHandler>
> = {
  [GoalClassification.enum.out_of_scope]: handleOutOfScopeRedirect,
  [GoalClassification.enum.unrealistic]: handleUnrealisticExpectations,
  [GoalClassification.enum.contradictory]: handleContradictoryRisk,
};

export const runClarifyStage = async (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<UserProfile | null> => {
  logger.info("Starting clarify stage", { goal });

  const classification = await classifyGoal(goal);

  let fieldsSource: PhaseSourceParams;

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
    fieldsSource = { input: [], previous_response_id: result.responseId };
  } else {
    fieldsSource = { input: goal };
  }

  const fieldsResponseId = await collectFields(fieldsSource, sendToUser, waitForResponse);
  const prefsResponseId = await collectPreferences(
    fieldsResponseId,
    sendToUser,
    waitForResponse,
  );
  const profile = await extractUserProfile(prefsResponseId);

  logger.info("Clarify stage complete");

  return profile;
};
