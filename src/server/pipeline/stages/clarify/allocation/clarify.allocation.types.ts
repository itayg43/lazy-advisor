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

/**
 * Immutable per-phase inputs shared by the proposal/composer functions —
 * derived once in `collectAllocation` and passed through, never mutated.
 */
export type AllocationProposalContext = {
  amount: number;
  timeline: AllocationTimeline;
  suggestedEquityRange: AllocationSuggestedEquityRange;
};

/**
 * Sticky "have we already shown this framing?" flags. Once a counter branch is
 * shown its flag stays true for the rest of the phase, so `selectCounterBranch`
 * won't repeat it. Grouped because they travel together through branch
 * selection (`selectCounterBranch`), the post-branch update (`applyBranchFraming`),
 * and the threaded state.
 */
export type AllocationFramingFlags = {
  hasShownExtremeFraming: boolean;
  hasShownCompoundImpactFraming: boolean;
};

/**
 * Negotiation state threaded across turns. Owned by the runner once
 * `initHandler` returns it; every handler receives it `Readonly` and produces
 * a new value via spread rather than mutating in place.
 */
export type AllocationNegotiationState = AllocationFramingFlags & {
  currentEquityPercentage: number;
  turnsTaken: number;
};

export type AllocationHandlerOutput = HandlerOutput<
  AllocationNegotiationState,
  AllocationPhaseResult
>;

// State mutations a turn handler may request. `turnsTaken` is excluded — the
// turn runner owns that counter and increments it centrally, so a handler can
// never write it. `createTurnHandler` merges the patch over the prior state.
type AllocationStatePatch = Partial<Omit<AllocationNegotiationState, "turnsTaken">>;

/**
 * What a *continuing* turn handler returns: ask again, carrying only the fields
 * that changed (`statePatch`). Distinct from `AllocationHandlerOutput` — the
 * handler decides *what* changed; `createTurnHandler` applies the `turnsTaken`
 * increment and merges the patch into the full successor state in one place.
 * Terminal turns (accept / budget exhaustion) skip this and return an
 * `AllocationHandlerOutput` Done directly: they end the phase, so there's no
 * successor state to assemble and the patch concept doesn't apply.
 */
export type AllocationAskDecision = {
  kind: typeof HandlerOutputKind.Ask;
  message: string;
  statePatch?: AllocationStatePatch;
};

type AllocationCounterBranchKind = z.infer<typeof AllocationCounterBranchKindEnum>;
type AllocationExtremeCounterDirection = z.infer<
  typeof AllocationExtremeCounterDirectionEnum
>;

/**
 * Counter-proposal branch — Rule 3 in clarify.allocation.rules.md. Selected in
 * code from {hasShownExtremeFraming, hasShownCompoundImpactFraming, isExtreme(proposed, range)}.
 */
export type AllocationCounterBranch =
  | {
      kind: Extract<AllocationCounterBranchKind, "extreme">;
      direction: AllocationExtremeCounterDirection;
    }
  | { kind: Extract<AllocationCounterBranchKind, "compound-impact"> }
  | { kind: Extract<AllocationCounterBranchKind, "bare"> };
