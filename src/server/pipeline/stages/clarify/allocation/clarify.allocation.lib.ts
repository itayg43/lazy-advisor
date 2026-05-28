import {
  EXTREME_DEVIATION_PERCENTAGE_POINTS,
  type AllocationSuggestedEquityRange,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import {
  AllocationCounterBranchKindEnum,
  AllocationExtremeCounterDirectionEnum,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type { AllocationCounterBranch } from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import type { RiskSelfRatingScore } from "#pipeline/stages/clarify/risk/clarify.risk.types";

export const formatCurrency = (n: number): string => `₪${n.toLocaleString("en-US")}`;

export const calculateBufferPercentage = (equityPercentage: number): number =>
  100 - equityPercentage;

export const pickEquityPercentage = (
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
      return (range.min + range.max) / 2;
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
  hasShownExtremeFraming: boolean,
  hasShownCompoundImpactFraming: boolean,
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
