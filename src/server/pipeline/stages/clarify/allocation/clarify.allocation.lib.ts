import {
  EXTREME_DEVIATION_PERCENTAGE_POINTS,
  type AllocationSuggestedEquityRange,
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
  AllocationIntentKind,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import type { RiskSelfRatingScore } from "#pipeline/stages/clarify/risk/clarify.risk.types";

export const formatCurrency = (n: number): string => `₪${n.toLocaleString("en-US")}`;

export const calculateBufferPercentage = (equityPercentage: number): number =>
  100 - equityPercentage;

export const isAcceptKind = (
  kind: AllocationIntentKind,
): kind is AllocationAcceptIntentKind =>
  kind === AllocationIntentKindEnum.enum.accept ||
  kind === AllocationIntentKindEnum.enum["accept-original"];

export const deriveAnchorEquityPercentage = (
  range: AllocationSuggestedEquityRange,
  score: RiskSelfRatingScore,
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
  }
};

export const computeSplit = (
  amount: number,
  equityPercentage: number,
): { equityAmount: number; bufferAmount: number } => {
  const equityAmount = (amount * equityPercentage) / 100;

  return { equityAmount, bufferAmount: amount - equityAmount };
};

export const equityDeviationPercentagePoints = (
  proposedEquityPercentage: number,
  suggestedEquityRange: AllocationSuggestedEquityRange,
): number =>
  Math.max(
    0,
    proposedEquityPercentage - suggestedEquityRange.max,
    suggestedEquityRange.min - proposedEquityPercentage,
  );

export const selectCounterBranch = (
  proposedEquityPercentage: number,
  suggestedEquityRange: AllocationSuggestedEquityRange,
  { hasShownExtremeFraming, hasShownCompoundImpactFraming }: AllocationFramingFlags,
): AllocationCounterBranch => {
  const deviation = equityDeviationPercentagePoints(
    proposedEquityPercentage,
    suggestedEquityRange,
  );
  if (deviation >= EXTREME_DEVIATION_PERCENTAGE_POINTS && !hasShownExtremeFraming) {
    return {
      kind: AllocationCounterBranchKindEnum.enum.extreme,
      direction:
        proposedEquityPercentage > suggestedEquityRange.max
          ? AllocationExtremeCounterDirectionEnum.enum["too-high"]
          : AllocationExtremeCounterDirectionEnum.enum["too-low"],
    };
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

      throw new Error(
        `applyBranchFraming: unhandled branch kind: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }
};
