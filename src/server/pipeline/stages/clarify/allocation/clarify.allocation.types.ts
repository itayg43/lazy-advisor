import type { z } from "zod";

import type { AllocationTimeline } from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import type {
  AllocationClassifierOutputSchema,
  AllocationIntentKindEnum,
  AllocationPhaseOutputSchema,
  AllocationPhaseResultSchema,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type { RiskSelfRatingScore } from "#pipeline/stages/clarify/risk/clarify.risk.types";
import type { RiskTolerance } from "#types/pipeline.types";

export type AllocationPhaseInput = {
  amount: number;
  timeline: AllocationTimeline;
  riskTolerance: RiskTolerance;
  riskSelfRatingScore: RiskSelfRatingScore;
};

export type AllocationPhaseOutput = z.infer<typeof AllocationPhaseOutputSchema>;
export type AllocationPhaseResult = z.infer<typeof AllocationPhaseResultSchema>;

export type AllocationIntentKind = z.infer<typeof AllocationIntentKindEnum>;
export type AllocationClassifierOutput = z.infer<typeof AllocationClassifierOutputSchema>;

// Counter-proposal branch — Rule 3 in clarify.allocation.rules.md. Selected in
// code from {counters, hasShownCompoundImpactFraming, isExtreme(proposed, cell)}.
export type CounterBranch =
  | { kind: "extreme"; direction: "too-high" | "too-low" }
  | { kind: "compound-impact" }
  | { kind: "bare" };
