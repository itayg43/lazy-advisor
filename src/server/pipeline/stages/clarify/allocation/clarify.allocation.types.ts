import type { z } from "zod";

import { DirectiveKind, type TurnHandlerOutput } from "#pipeline/run-conversation";
import type { AllocationTimeline } from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import type {
  AllocationClassifierOutputSchema,
  AllocationCounterBranchKindEnum,
  AllocationCounterDirectionEnum,
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
export type AllocationAcceptIntentKind = Extract<
  AllocationIntentKind,
  "accept" | "accept-original"
>;
export type AllocationClassifierOutput = z.infer<typeof AllocationClassifierOutputSchema>;

// Negotiation state threaded across turns. Owned by the runner once
// `initHandler` returns it; every handler receives it `Readonly` and produces
// a new value via spread rather than mutating in place.
export type AllocationConversationState = {
  currentEquityPercentage: number;
  extremeFramingShown: boolean;
  compoundImpactFramingShown: boolean;
  turnsTaken: number;
};

export type AllocationTurnOutput = TurnHandlerOutput<
  AllocationConversationState,
  AllocationPhaseResult
>;
export type AllocationTurnAskOutput = Extract<
  AllocationTurnOutput,
  { kind: typeof DirectiveKind.Ask }
>;
export type AllocationTurnDoneOutput = Extract<
  AllocationTurnOutput,
  { kind: typeof DirectiveKind.Done }
>;

export type AllocationCounterBranchKind = z.infer<typeof AllocationCounterBranchKindEnum>;
export type AllocationCounterDirection = z.infer<typeof AllocationCounterDirectionEnum>;

// Counter-proposal branch — Rule 3 in clarify.allocation.rules.md. Selected in
// code from {counters, hasShownCompoundImpactFraming, isExtreme(proposed, range)}.
export type AllocationCounterBranch =
  | {
      kind: Extract<AllocationCounterBranchKind, "extreme">;
      direction: AllocationCounterDirection;
    }
  | { kind: Extract<AllocationCounterBranchKind, "compound-impact"> }
  | { kind: Extract<AllocationCounterBranchKind, "bare"> };
