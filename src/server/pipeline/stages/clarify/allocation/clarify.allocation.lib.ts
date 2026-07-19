import { InternalError } from "#errors";
import {
  ALLOCATION_ANCHOR_DATA,
  ALLOCATION_EXTREME_DEVIATION_PERCENTAGE_POINTS,
  type AllocationSuggestedEquityRange,
  type AllocationTimeline,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import {
  AllocationCounterBranchKindEnum,
  AllocationExtremeCounterDirectionEnum,
  AllocationIntentKindEnum,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type {
  AllocationAcceptIntentKind,
  AllocationCounterBranch,
  AllocationFramingFlags,
  AllocationIntent,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import type { RiskTolerance } from "#pipeline/stages/clarify/risk/clarify.risk.types";

/** Formats a shekel amount with thousands separators (e.g. `120000` → `₪120,000`). */
export const formatCurrency = (amount: number): string =>
  `₪${amount.toLocaleString("en-US")}`;

/** The buffer's share of the portfolio — the complement of the equity percentage. */
export const calculateBufferPercentage = (equityPercentage: number): number =>
  100 - equityPercentage;

/**
 * Type guard for the two terminal accept intents (`accept`, `accept-original`).
 * Narrows the whole intent so the negative branch yields `AllocationContinuingIntent`.
 */
export const isAcceptIntent = (
  intent: AllocationIntent,
): intent is Extract<AllocationIntent, { kind: AllocationAcceptIntentKind }> =>
  intent.kind === AllocationIntentKindEnum.enum.accept ||
  intent.kind === AllocationIntentKindEnum.enum["accept-original"];

/**
 * Picks the opening equity percentage from the suggested range using the user's
 * 1–5 `riskTolerance`: cautious scores anchor to the low edge, bold scores to the
 * high edge, and a neutral score to the (integer-rounded) midpoint. Pairs of
 * scores share a range in the anchor table (1≡2, 4≡5); this is what distinguishes
 * them — 1 and 4 take the low edge, 2 and 5 the high edge.
 */
export const deriveAnchorEquityPercentage = (
  range: AllocationSuggestedEquityRange,
  score: RiskTolerance,
): number => {
  switch (score) {
    case 1:
    case 4:
      return range.min;
    case 2:
    case 5:
      return range.max;
    case 3:
      // Round to an integer: the phase result schema requires integer equity,
      // and a cell whose bounds sum to an odd number yields a .5 midpoint.
      return Math.round((range.min + range.max) / 2);

    // Dual-guard, as in applyBranchFraming: the `never` assignment fails
    // type-check if `RiskTolerance` ever widens, and the throw covers a runtime
    // lie (an unsafe cast or drifted persisted score). Throwing at the anchor
    // source fails loud near the cause rather than letting an `undefined` derive
    // a NaN split that surfaces as a 500 far downstream.
    default: {
      const _exhaustive: never = score;

      throw new InternalError(
        `deriveAnchorEquityPercentage: unhandled risk score: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
};

/**
 * Resolves the anchor cell for a `riskTolerance` × `timeline` pair: looks up the
 * suggested equity range in the anchor table and derives the opening equity
 * percentage from it. Returns both — the range is also needed downstream (the
 * counter branch selector reads it), and returning it here keeps the table
 * lookup to a single site. `deriveAnchorEquityPercentage` stays a pure,
 * table-agnostic helper so it can be unit-tested against synthetic ranges.
 */
export const resolveAllocationAnchor = (
  riskTolerance: RiskTolerance,
  timeline: AllocationTimeline,
): {
  suggestedEquityRange: AllocationSuggestedEquityRange;
  anchorEquityPercentage: number;
} => {
  const suggestedEquityRange = ALLOCATION_ANCHOR_DATA[riskTolerance][timeline];

  return {
    suggestedEquityRange,
    anchorEquityPercentage: deriveAnchorEquityPercentage(
      suggestedEquityRange,
      riskTolerance,
    ),
  };
};

/** Splits an amount into its equity and buffer shekel amounts at the given equity percentage. */
export const computeSplit = (
  amount: number,
  equityPercentage: number,
): { equityAmount: number; bufferAmount: number } => {
  const equityAmount = (amount * equityPercentage) / 100;

  return { equityAmount, bufferAmount: amount - equityAmount };
};

/**
 * Chooses which counter framing to show for an off-range proposal, escalating
 * once through each framing the user hasn't seen yet: an `extreme` warning when
 * the proposal is far past the suggested range, otherwise `compound-impact`,
 * otherwise a `bare` restatement. Reads the framing flags to avoid repeating a
 * framing; `applyBranchFraming` records the chosen branch back into those flags.
 */
export const selectCounterBranch = (
  proposedEquityPercentage: number,
  suggestedEquityRange: AllocationSuggestedEquityRange,
  framingFlags: AllocationFramingFlags,
): AllocationCounterBranch => {
  const { hasShownExtremeFraming, hasShownCompoundImpactFraming } = framingFlags;

  // Distance past the nearest edge of the suggested range; 0 while inside it.
  const deviationPercentagePoints = Math.max(
    0,
    proposedEquityPercentage - suggestedEquityRange.max,
    suggestedEquityRange.min - proposedEquityPercentage,
  );

  if (
    deviationPercentagePoints >= ALLOCATION_EXTREME_DEVIATION_PERCENTAGE_POINTS &&
    !hasShownExtremeFraming
  ) {
    // The deviation is a magnitude — equally large above max or below min — so it
    // can't tell us the side. Re-check against max to recover the direction.
    const direction =
      proposedEquityPercentage > suggestedEquityRange.max
        ? AllocationExtremeCounterDirectionEnum.enum["too-high"]
        : AllocationExtremeCounterDirectionEnum.enum["too-low"];

    return { kind: AllocationCounterBranchKindEnum.enum.extreme, direction };
  }
  if (!hasShownCompoundImpactFraming) {
    return { kind: AllocationCounterBranchKindEnum.enum["compound-impact"] };
  }

  return { kind: AllocationCounterBranchKindEnum.enum.bare };
};

/**
 * Maps a chosen branch to the framing flag it marks as shown (flags only ever
 * flip true). Co-located with `selectCounterBranch` — which reads these flags to
 * pick the branch — so the branch↔flag knowledge lives in one place. Switching
 * on `counterBranch.kind` with the exhaustiveness guard makes adding a branch
 * kind a compile error here, so the mapping can't drift from the selector.
 */
export const applyBranchFraming = (
  framingFlags: AllocationFramingFlags,
  counterBranch: AllocationCounterBranch,
): AllocationFramingFlags => {
  // Destructure and build each return from the two named fields: TypeScript lets
  // a structurally-wider argument (e.g. the full negotiation state) satisfy
  // `AllocationFramingFlags`, and spreading that argument would copy its extra
  // runtime properties — which then overwrite unrelated keys when the caller
  // spreads the result into a state patch. Building from the named fields keeps
  // the result narrow regardless of what was passed.
  const { hasShownExtremeFraming, hasShownCompoundImpactFraming } = framingFlags;

  switch (counterBranch.kind) {
    case AllocationCounterBranchKindEnum.enum.extreme:
      return { hasShownExtremeFraming: true, hasShownCompoundImpactFraming };
    case AllocationCounterBranchKindEnum.enum["compound-impact"]:
      return { hasShownCompoundImpactFraming: true, hasShownExtremeFraming };
    case AllocationCounterBranchKindEnum.enum.bare:
      return { hasShownExtremeFraming, hasShownCompoundImpactFraming };

    default: {
      const _exhaustive: never = counterBranch;

      throw new InternalError(
        `applyBranchFraming: unhandled branch kind: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
};
