import type { z } from "zod";

// Stage→intake type-only import is intentional: ClarifyStageResult's intake_rejected
// variant carries this intake-owned concept.
import type { RedirectingClassification } from "#pipeline/stages/clarify/intake/clarify.intake.types";
import type {
  ClarifyErroredReasonEnum,
  ClarifyHaltReasonEnum,
  ClarifyUnresolvedReasonEnum,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { PipelineStatus, UserProfile } from "#types/pipeline.types";

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
