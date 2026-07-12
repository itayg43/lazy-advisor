import {
  SERVICE_UNAVAILABLE_EXIT_MESSAGE,
  SYSTEM_ERROR_EXIT_MESSAGE,
} from "#constants/pipeline.constants";
import { createLogger } from "#lib/logger";
import { ClassifyErroredReasonEnum } from "#pipeline/ask-with-classify";
import { runClarifyStage } from "#pipeline/stages/clarify/clarify.stage";
import {
  ALLOCATION_EXIT_MESSAGE,
  CLARIFY_HALT_MESSAGES,
  CLARIFY_UNRESOLVED_MESSAGES,
  INTAKE_REDIRECT_REJECTION_MESSAGES,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import {
  ClarifyHaltReasonEnum,
  ClarifyPhaseEnum,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  ClarifyOrchestratorResult,
  ClarifyStageResult,
  ClarifyStageTermination,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const logger = createLogger("clarifyOrchestrator");

export const runClarifyOrchestrator = async (
  goal: string,
  responder: Responder,
): Promise<ClarifyOrchestratorResult> => {
  let result: ClarifyStageResult;

  // Narrow try: only wraps the stage call so unrelated throws (e.g. from
  // message resolution below) propagate up instead of being misattributed as
  // a stage failure.
  try {
    result = await runClarifyStage(goal, responder);
  } catch (error) {
    logger.error("Clarify stage failed unexpectedly", error);

    return {
      status: PipelineStatusEnum.enum.errored,
      message: SYSTEM_ERROR_EXIT_MESSAGE,
    };
  }

  if (result.status !== PipelineStatusEnum.enum.completed) {
    return { status: result.status, message: resolveTerminationMessage(result) };
  }

  return { status: result.status, profile: result.profile };
};

const resolveHaltMessage = (
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

const resolveUnresolvedMessage = (
  result: Extract<ClarifyStageTermination, { status: "unresolved" }>,
): string => {
  // A `phase` marks the migrated (runConversation) arm; the granular reason is
  // log-only, so the message is keyed on phase. Legacy arms carry no phase and key
  // the message on their phase-name reason.
  if (result.phase === ClarifyPhaseEnum.enum.allocation) {
    logger.info("Clarify stage unresolved", {
      phase: result.phase,
      reason: result.reason,
    });

    return ALLOCATION_EXIT_MESSAGE;
  }

  logger.info("Clarify stage unresolved", { reason: result.reason });

  return CLARIFY_UNRESOLVED_MESSAGES[result.reason];
};

const resolveErroredMessage = (
  result: Extract<ClarifyStageTermination, { status: "errored" }>,
): string => {
  // Migrated (runConversation) arm: `errored` here is only ever an upstream fault the
  // phase caught (our-faults throw and hit the top-level catch), so both granular
  // reasons invite a sooner retry. Reason is log-only; the message keys on phase.
  if (result.phase === ClarifyPhaseEnum.enum.allocation) {
    logger.warn("Clarify stage errored — upstream failure", {
      phase: result.phase,
      reason: result.reason,
    });

    return SERVICE_UNAVAILABLE_EXIT_MESSAGE;
  }

  // Legacy ask-with-classify arm, which conflates two causes under `errored` and so
  // must split by reason. (It retires with ask-with-classify once every phase moves
  // to the runConversation shape, where our-faults throw instead of going in-band.)
  switch (result.reason) {
    // Our-fault: clarificationNeeded=true with a null message is a bug on our side,
    // not an upstream hiccup — the generic our-end message, matching the top catch.
    case ClassifyErroredReasonEnum.enum.classify_message_missing:
      logger.error("Clarify stage errored — internal fault", { reason: result.reason });

      return SYSTEM_ERROR_EXIT_MESSAGE;

    // Upstream fault the phase caught (a bad classify response). Not our bug.
    case ClassifyErroredReasonEnum.enum.classify_resolved_output_invalid:
      logger.warn("Clarify stage errored — upstream failure", { reason: result.reason });

      return SERVICE_UNAVAILABLE_EXIT_MESSAGE;

    // Dual-guard, as in resolveHaltMessage.
    default: {
      const _exhaustive: never = result;
      logger.error("Unhandled clarify errored reason", { result: _exhaustive });

      return SYSTEM_ERROR_EXIT_MESSAGE;
    }
  }
};

const resolveTerminationMessage = (result: ClarifyStageTermination): string => {
  switch (result.status) {
    case PipelineStatusEnum.enum.halted: {
      logger.info("Clarify stage halted", { reason: result.reason });

      return resolveHaltMessage(result);
    }
    case PipelineStatusEnum.enum.unresolved: {
      return resolveUnresolvedMessage(result);
    }
    case PipelineStatusEnum.enum.errored: {
      return resolveErroredMessage(result);
    }

    default: {
      const _exhaustive: never = result;
      logger.error("Unhandled clarify termination status", { result: _exhaustive });

      return SYSTEM_ERROR_EXIT_MESSAGE;
    }
  }
};
