import type { z } from "zod";

import type {
  ClarifyErroredReasonEnum,
  ClarifyHaltReasonEnum,
  ClarifyUnresolvedReasonEnum,
  GoalClassificationEnum,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { PipelineStatus, UserProfile } from "#types/pipeline.types";

export type GoalClassification = z.infer<typeof GoalClassificationEnum>;
export type RedirectingClassification = Exclude<GoalClassification, "normal">;

export type ClarifyUnresolvedReason = z.infer<typeof ClarifyUnresolvedReasonEnum>;
export type ClarifyHaltReason = z.infer<typeof ClarifyHaltReasonEnum>;
export type ClarifyErroredReason = z.infer<typeof ClarifyErroredReasonEnum>;

export type ClarifyStageResult =
  | { status: Extract<PipelineStatus, "completed">; profile: UserProfile }
  | {
      status: Extract<PipelineStatus, "halted">;
      reason: Extract<ClarifyHaltReason, "short_timeline">;
    }
  | {
      status: Extract<PipelineStatus, "halted">;
      reason: Extract<ClarifyHaltReason, "intake_rejected">;
      classification: RedirectingClassification;
    }
  | { status: Extract<PipelineStatus, "unresolved">; reason: ClarifyUnresolvedReason }
  | { status: Extract<PipelineStatus, "errored">; reason: ClarifyErroredReason };

export type ClarifyStageTermination = Exclude<
  ClarifyStageResult,
  { status: Extract<PipelineStatus, "completed"> }
>;
