import type { z } from "zod";

import type {
  AllocationPhaseOutputSchema,
  AllocationPhaseResultSchema,
  ClarifyErroredReasonEnum,
  ClarifyHaltReasonEnum,
  ClarifyUnresolvedReasonEnum,
  ContributionPhaseOutputSchema,
  GoalClassificationEnum,
  GoalClassificationSchema,
  IntakePhaseOutputSchema,
  ParametersPhaseOutputSchema,
  ParametersPhaseResultSchema,
  RiskPhaseOutputSchema,
  RiskPhaseResultSchema,
  RiskScoreSchema,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { PipelineStatus, UserProfile } from "#types/pipeline.types";

export type GoalClassification = z.infer<typeof GoalClassificationEnum>;
export type GoalClassificationOutput = z.infer<typeof GoalClassificationSchema>;
export type RedirectingClassification = Exclude<GoalClassification, "normal">;

export type ClarifyUnresolvedReason = z.infer<typeof ClarifyUnresolvedReasonEnum>;
export type ClarifyHaltReason = z.infer<typeof ClarifyHaltReasonEnum>;
export type ClarifyErroredReason = z.infer<typeof ClarifyErroredReasonEnum>;

export type IntakePhaseOutput = z.infer<typeof IntakePhaseOutputSchema>;
export type ParametersPhaseOutput = z.infer<typeof ParametersPhaseOutputSchema>;
export type ParametersPhaseResult = z.infer<typeof ParametersPhaseResultSchema>;
export type RiskScore = z.infer<typeof RiskScoreSchema>;
export type RiskPhaseOutput = z.infer<typeof RiskPhaseOutputSchema>;
export type RiskPhaseResult = z.infer<typeof RiskPhaseResultSchema>;
export type AllocationPhaseOutput = z.infer<typeof AllocationPhaseOutputSchema>;
export type AllocationPhaseResult = z.infer<typeof AllocationPhaseResultSchema>;
export type ContributionPhaseOutput = z.infer<typeof ContributionPhaseOutputSchema>;

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
