import type { z } from "zod";

import { HandlerOutputKind, type HandlerOutput } from "#pipeline/run-conversation";
import type {
  AllocationSuggestedEquityRange,
  AllocationTimeline,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import type {
  AllocationClassifierOutputSchema,
  AllocationCounterBranchKindEnum,
  AllocationExtremeCounterDirectionEnum,
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

// Immutable per-phase inputs shared by the proposal/composer functions —
// derived once in `collectAllocation` and passed through, never mutated.
export type AllocationProposalContext = {
  amount: number;
  timeline: string;
  suggestedEquityRange: AllocationSuggestedEquityRange;
};

// Negotiation state threaded across turns. Owned by the runner once
// `initHandler` returns it; every handler receives it `Readonly` and produces
// a new value via spread rather than mutating in place.
export type AllocationNegotiationState = {
  currentEquityPercentage: number;
  hasShownExtremeFraming: boolean;
  hasShownCompoundImpactFraming: boolean;
  turnsTaken: number;
};

export type AllocationHandlerOutput = HandlerOutput<
  AllocationNegotiationState,
  AllocationPhaseResult
>;

// State mutations a turn handler may request. `turnsTaken` is excluded — the
// turn runner owns that counter and increments it centrally, so a handler can
// never write it. `createTurnHandler` merges the patch over the prior state.
export type AllocationStatePatch = Partial<
  Omit<AllocationNegotiationState, "turnsTaken">
>;

// What a turn handler returns: end the phase (Done) or ask again (Ask) carrying
// only the fields that changed. Distinct from `AllocationHandlerOutput` — a
// handler decides *what* changed; `createTurnHandler` maps the decision to a
// runner output, assembling the full successor state in one place.
export type AllocationTurnDecision =
  | {
      kind: typeof HandlerOutputKind.Done;
      message?: string;
      result: AllocationPhaseResult;
    }
  | {
      kind: typeof HandlerOutputKind.Ask;
      message: string;
      statePatch?: AllocationStatePatch;
    };
export type AllocationTurnDoneDecision = Extract<
  AllocationTurnDecision,
  { kind: typeof HandlerOutputKind.Done }
>;
export type AllocationTurnAskDecision = Extract<
  AllocationTurnDecision,
  { kind: typeof HandlerOutputKind.Ask }
>;

export type AllocationCounterBranchKind = z.infer<typeof AllocationCounterBranchKindEnum>;
export type AllocationExtremeCounterDirection = z.infer<
  typeof AllocationExtremeCounterDirectionEnum
>;

// Counter-proposal branch — Rule 3 in clarify.allocation.rules.md. Selected in
// code from {counters, hasShownCompoundImpactFraming, isExtreme(proposed, range)}.
export type AllocationCounterBranch =
  | {
      kind: Extract<AllocationCounterBranchKind, "extreme">;
      direction: AllocationExtremeCounterDirection;
    }
  | { kind: Extract<AllocationCounterBranchKind, "compound-impact"> }
  | { kind: Extract<AllocationCounterBranchKind, "bare"> };
