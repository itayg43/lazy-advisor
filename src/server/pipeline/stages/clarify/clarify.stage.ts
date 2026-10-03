import { createLogger } from "#lib/logger";
import { collectAllocation } from "#pipeline/stages/clarify/allocation/clarify.allocation";
import { collectAmount } from "#pipeline/stages/clarify/amount/clarify.amount";
import { collectContribution } from "#pipeline/stages/clarify/contribution/clarify.contribution";
import { collectEfDebt } from "#pipeline/stages/clarify/ef-debt/clarify.ef-debt";
import { INTAKE_HANDLERS } from "#pipeline/stages/clarify/intake/clarify.intake.handlers";
import { classifyGoal } from "#pipeline/stages/clarify/intake/classify/clarify.classify";
import { collectRisk } from "#pipeline/stages/clarify/risk/clarify.risk";
import {
  PROFILE_TRANSITION_MESSAGE,
  SHORT_TIMELINE_BUCKET,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import {
  ClarifyHaltReasonEnum,
  ClarifyPhaseEnum,
  GoalClassificationEnum,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { ClarifyStageResult } from "#pipeline/stages/clarify/shared/clarify.types";
import { collectTimeline } from "#pipeline/stages/clarify/timeline/clarify.timeline";
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

  const amountResult = await collectAmount(responder);
  if (amountResult.status !== PipelineStatusEnum.enum.completed) {
    return amountResult;
  }

  const { amount } = amountResult;

  const timelineResult = await collectTimeline(responder);
  if (timelineResult.status !== PipelineStatusEnum.enum.completed) {
    return timelineResult;
  }

  const { timeline } = timelineResult;

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
    { amount, timeline, riskTolerance },
    responder,
  );
  // Allocation self-reports a granular *reason* — why it couldn't complete: which
  // budget ran out (unresolved), or which class of upstream fault it caught (errored).
  // The stage owns only *which* phase, so it spreads the phase result and attaches
  // `phase` — both terminal statuses are handled identically, so no per-status branch.
  // (The pre-runConversation phases above still self-report a phase-name reason and
  // carry no `phase` — allocation is the first migrated to this phase/reason split.)
  if (allocationResult.status !== PipelineStatusEnum.enum.completed) {
    return { ...allocationResult, phase: ClarifyPhaseEnum.enum.allocation };
  }

  const { equityPercentage, bufferPercentage } = allocationResult;

  // No completed-guard here, unlike every phase above: contribution is
  // non-blocking, so its result carries no `status` (it collapses all failures to
  // `plansToContribute: false` internally) and can't terminate the stage. The
  // asymmetry is intentional, not a missing guard.
  const contributionResult = await collectContribution(
    amount,
    equityPercentage,
    responder,
  );

  const { plansToContribute } = contributionResult;

  const profile = UserProfileSchema.parse({
    amount,
    timeline,
    equityPercentage,
    bufferPercentage,
    plansToContribute,
  });

  logger.info("Clarify stage complete");
  logger.debug("Profile output", { profile });

  return { status: PipelineStatusEnum.enum.completed, profile };
};
