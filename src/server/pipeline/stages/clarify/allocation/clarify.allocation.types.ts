import type { z } from "zod";

import type { AllocationTimeline } from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import type {
  AllocationPhaseOutputSchema,
  AllocationPhaseResultSchema,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type { SelfRatingScore } from "#pipeline/stages/clarify/risk/clarify.risk.types";
import type { RiskTolerance } from "#types/pipeline.types";

export type AllocationPhaseInput = {
  amount: number;
  timeline: AllocationTimeline;
  riskTolerance: RiskTolerance;
  selfRatingScore: SelfRatingScore;
};

export type AllocationPhaseOutput = z.infer<typeof AllocationPhaseOutputSchema>;
export type AllocationPhaseResult = z.infer<typeof AllocationPhaseResultSchema>;
