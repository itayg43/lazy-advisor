import type { z } from "zod";

import type { ClassifyErroredReason } from "#pipeline/ask-with-classify";
import type {
  RiskClassifySchema,
  RiskPhaseResultSchema,
  RiskToleranceSchema,
} from "#pipeline/stages/clarify/risk/clarify.risk.schemas";
import type { ClarifyUnresolvedReason } from "#pipeline/stages/clarify/shared/clarify.types";
import type { PipelineStatus } from "#types/pipeline.types";

export type RiskPhaseResult = z.infer<typeof RiskPhaseResultSchema>;

export type RiskClassify = z.infer<typeof RiskClassifySchema>;

export type RiskTolerance = z.infer<typeof RiskToleranceSchema>;

export type AskRiskResult =
  | {
      status: Extract<PipelineStatus, "completed">;
      riskTolerance: RiskTolerance;
    }
  | {
      status: Extract<PipelineStatus, "unresolved">;
      reason: Extract<ClarifyUnresolvedReason, "risk_tolerance">;
    }
  | { status: Extract<PipelineStatus, "errored">; reason: ClassifyErroredReason };
