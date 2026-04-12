import { createLogger } from "#lib/logger";
import { extractUserProfile } from "#pipeline/stages/clarify/extraction/clarify.extraction";
import { collectFields } from "#pipeline/stages/clarify/fields/clarify.fields";
import { collectPreferences } from "#pipeline/stages/clarify/preferences/clarify.preferences";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import type { UserProfile } from "#types/pipeline.types";

const logger = createLogger("clarifyStage");

export const runClarifyStage = async (
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<UserProfile> => {
  logger.info("Starting clarify stage", { goal });

  const fieldsResponseId = await collectFields(goal, sendToUser, waitForResponse);
  const prefsResponseId = await collectPreferences(
    fieldsResponseId,
    sendToUser,
    waitForResponse,
  );
  const profile = await extractUserProfile(prefsResponseId);

  logger.info("Clarify stage complete");

  return profile;
};
