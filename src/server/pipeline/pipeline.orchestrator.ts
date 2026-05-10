import { createLogger } from "#lib/logger";
import { runWithSession } from "#lib/session-context";
import { runClarifyStage } from "#pipeline/stages/clarify/clarify.stage";
import {
  CLARIFY_ERRORED_MESSAGES,
  CLARIFY_HALT_MESSAGES,
  CLARIFY_UNRESOLVED_MESSAGES,
  INTAKE_REDIRECT_REJECTION_MESSAGES,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import { ClarifyHaltReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { ClarifyStageResult } from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const logger = createLogger("pipelineOrchestrator");

export const runPipeline = async (
  sessionId: string,
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<void> => {
  return runWithSession(sessionId, async () => {
    const clarifyResult = await runClarifyStage(goal, sendToUser, waitForResponse);
    if (clarifyResult.status !== PipelineStatusEnum.enum.completed) {
      handleClarifyTermination(clarifyResult, sendToUser);

      return;
    }

    // Future stages slot in here. The last stage's `completed` arm will send the
    // final formatted output via sendToUser; runPipeline returns void either way.
  });
};

const handleClarifyTermination = (
  result: Exclude<ClarifyStageResult, { status: "completed" }>,
  sendToUser: SendToUser,
): void => {
  switch (result.status) {
    case PipelineStatusEnum.enum.halted: {
      logger.info("Clarify stage halted", { reason: result.reason });
      switch (result.reason) {
        case ClarifyHaltReasonEnum.enum.intake_rejected:
          sendToUser(INTAKE_REDIRECT_REJECTION_MESSAGES[result.classification]);
          break;
        case ClarifyHaltReasonEnum.enum.short_timeline:
          sendToUser(CLARIFY_HALT_MESSAGES[result.reason]);
          break;
      }

      return;
    }
    case PipelineStatusEnum.enum.unresolved: {
      logger.info("Clarify stage unresolved", { reason: result.reason });
      sendToUser(CLARIFY_UNRESOLVED_MESSAGES[result.reason]);

      return;
    }
    case PipelineStatusEnum.enum.errored: {
      logger.error("Clarify stage errored", { reason: result.reason });
      sendToUser(CLARIFY_ERRORED_MESSAGES[result.reason]);

      return;
    }
  }
};
