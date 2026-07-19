import type { z } from "zod";

import type { ClassifyErroredReason } from "#pipeline/ask-with-classify";
import type {
  AllocationErroredReason,
  AllocationUnresolvedReason,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import type {
  ClarifyHaltReasonEnum,
  ClarifyPhaseEnum,
  ClarifyUnresolvedReasonEnum,
  GoalClassificationEnum,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { PipelineStatus, UserProfile } from "#types/pipeline.types";

export type GoalClassification = z.infer<typeof GoalClassificationEnum>;
export type RedirectingClassification = Exclude<GoalClassification, "normal">;

export type ClarifyUnresolvedReason = z.infer<typeof ClarifyUnresolvedReasonEnum>;
export type ClarifyPhase = z.infer<typeof ClarifyPhaseEnum>;
export type ClarifyHaltReason = z.infer<typeof ClarifyHaltReasonEnum>;

// `phase` is the discriminant that splits each terminal status into a legacy arm
// (ask-with-classify phases, whose reason is the phase name / classify error) and a
// migrated arm (allocation, which self-reports a granular reason while the stage
// attaches `phase`). Legacy arms pin `phase?: undefined` so `result.phase` narrows
// cleanly at consumers. The legacy arms retire when ask-with-classify does.
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
  | {
      status: Extract<PipelineStatus, "unresolved">;
      phase?: undefined;
      reason: ClarifyUnresolvedReason;
    }
  | {
      status: Extract<PipelineStatus, "unresolved">;
      phase: ClarifyPhase;
      reason: AllocationUnresolvedReason;
    }
  | {
      status: Extract<PipelineStatus, "errored">;
      phase?: undefined;
      reason: ClassifyErroredReason;
    }
  | {
      status: Extract<PipelineStatus, "errored">;
      phase: ClarifyPhase;
      reason: AllocationErroredReason;
    };

export type ClarifyStageTermination = Exclude<
  ClarifyStageResult,
  { status: Extract<PipelineStatus, "completed"> }
>;

export type ClarifyOrchestratorResult =
  | { status: Extract<PipelineStatus, "completed">; profile: UserProfile }
  | { status: Exclude<PipelineStatus, "completed">; message: string };
