import type { z } from "zod";

import type {
  RiskClassifySchema,
  RiskPhaseOutputSchema,
  RiskPhaseResultSchema,
} from "#pipeline/stages/clarify/risk/clarify.risk.schemas";
import type {
  ClarifyErroredReason,
  ClarifyUnresolvedReason,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { PipelineStatus } from "#types/pipeline.types";

export type RiskPhaseOutput = z.infer<typeof RiskPhaseOutputSchema>;
export type RiskPhaseResult = z.infer<typeof RiskPhaseResultSchema>;

export type RiskClassify = z.infer<typeof RiskClassifySchema>;

export type AskRiskResult =
  | { status: Extract<PipelineStatus, "completed">; selfRatingScore: number }
  | {
      status: Extract<PipelineStatus, "unresolved">;
      reason: Extract<ClarifyUnresolvedReason, "risk_tolerance">;
    }
  | { status: Extract<PipelineStatus, "errored">; reason: ClarifyErroredReason };
