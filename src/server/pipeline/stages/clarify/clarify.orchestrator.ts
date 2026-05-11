import { createLogger } from "#lib/logger";
import { SYSTEM_ERROR_EXIT_MESSAGE } from "#pipeline/pipeline.constants";
import { runClarifyStage } from "#pipeline/stages/clarify/clarify.stage";
import {
  CLARIFY_HALT_MESSAGES,
  CLARIFY_UNRESOLVED_MESSAGES,
  INTAKE_REDIRECT_REJECTION_MESSAGES,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import { ClarifyHaltReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { ClarifyStageTermination } from "#pipeline/stages/clarify/shared/clarify.types";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";
import type { UserProfile } from "#types/pipeline.types";

const logger = createLogger("clarifyOrchestrator");

export const runClarifyOrTerminate = async (
  goal: string,
  responder: Responder,
): Promise<UserProfile | null> => {
  let result;

  try {
    result = await runClarifyStage(goal, responder);
  } catch (error) {
    logger.error("Clarify stage failed unexpectedly", error);

    responder.sendToUser(SYSTEM_ERROR_EXIT_MESSAGE);

    return null;
  }

  if (result.status !== PipelineStatusEnum.enum.completed) {
    responder.sendToUser(handleClarifyTerminationMessage(result));

    return null;
  }

  return result.profile;
};

const resolveClarifyHaltMessage = (
  result: Extract<ClarifyStageTermination, { status: "halted" }>,
): string => {
  switch (result.reason) {
    case ClarifyHaltReasonEnum.enum.intake_rejected:
      return INTAKE_REDIRECT_REJECTION_MESSAGES[result.classification];
    case ClarifyHaltReasonEnum.enum.short_timeline:
      return CLARIFY_HALT_MESSAGES[result.reason];

    // Dual-guard: `never` assignment fails type-check if a new variant is added to
    // the union; the runtime fallback covers cases where the type lies at runtime
    // (unsafe casts, persisted-data drift). Same pattern applied below.
    default: {
      const _exhaustive: never = result;
      logger.error("Unhandled halt reason", { result: _exhaustive });

      return SYSTEM_ERROR_EXIT_MESSAGE;
    }
  }
};

const handleClarifyTerminationMessage = (result: ClarifyStageTermination): string => {
  switch (result.status) {
    case PipelineStatusEnum.enum.halted: {
      logger.info("Clarify stage halted", { reason: result.reason });

      return resolveClarifyHaltMessage(result);
    }
    case PipelineStatusEnum.enum.unresolved: {
      logger.info("Clarify stage unresolved", { reason: result.reason });

      return CLARIFY_UNRESOLVED_MESSAGES[result.reason];
    }
    case PipelineStatusEnum.enum.errored: {
      logger.error("Clarify stage errored", { reason: result.reason });

      return SYSTEM_ERROR_EXIT_MESSAGE;
    }

    default: {
      const _exhaustive: never = result;
      logger.error("Unhandled clarify termination status", { result: _exhaustive });

      return SYSTEM_ERROR_EXIT_MESSAGE;
    }
  }
};
