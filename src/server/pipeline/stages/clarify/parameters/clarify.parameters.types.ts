import type { z } from "zod";

import type { ClassifyErroredReason } from "#pipeline/ask-with-classify";
import type {
  AmountClassifySchema,
  ParametersPhaseOutputSchema,
  ParametersPhaseResultSchema,
  TimelineClassifySchema,
} from "#pipeline/stages/clarify/parameters/clarify.parameters.schemas";
import type { ClarifyUnresolvedReason } from "#pipeline/stages/clarify/shared/clarify.types";
import type { PipelineStatus, TimelineBucket } from "#types/pipeline.types";

export type ParametersPhaseOutput = z.infer<typeof ParametersPhaseOutputSchema>;
export type ParametersPhaseResult = z.infer<typeof ParametersPhaseResultSchema>;

export type AmountClassify = z.infer<typeof AmountClassifySchema>;
export type TimelineClassify = z.infer<typeof TimelineClassifySchema>;

export type AskAmountResult =
  | { status: Extract<PipelineStatus, "completed">; amount: number }
  | {
      status: Extract<PipelineStatus, "unresolved">;
      reason: Extract<ClarifyUnresolvedReason, "amount">;
    }
  | { status: Extract<PipelineStatus, "errored">; reason: ClassifyErroredReason };

export type AskTimelineResult =
  | { status: Extract<PipelineStatus, "completed">; timeline: TimelineBucket }
  | {
      status: Extract<PipelineStatus, "unresolved">;
      reason: Extract<ClarifyUnresolvedReason, "timeline">;
    }
  | { status: Extract<PipelineStatus, "errored">; reason: ClassifyErroredReason };
