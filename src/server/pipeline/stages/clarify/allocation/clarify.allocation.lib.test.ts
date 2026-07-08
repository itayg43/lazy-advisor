import { describe, expect, it } from "vitest";

import {
  ALLOCATION_ANCHOR_DATA,
  ALLOCATION_EXTREME_DEVIATION_PERCENTAGE_POINTS,
  type AllocationSuggestedEquityRange,
  type AllocationTimeline,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import {
  applyBranchFraming,
  computeSplit,
  deriveAnchorEquityPercentage,
  resolveAllocationAnchor,
  selectCounterBranch,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.lib";
import {
  AllocationCounterBranchKindEnum,
  AllocationExtremeCounterDirectionEnum,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type {
  AllocationCounterBranch,
  AllocationFramingFlags,
  AllocationNegotiationState,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import type { RiskTolerance } from "#pipeline/stages/clarify/risk/clarify.risk.types";
import { TimelineBucketEnum } from "#schemas/pipeline.schemas";

describe("clarifyAllocationLib", () => {
  describe("deriveAnchorEquityPercentage", () => {
    const {
      "3–5 years": t3to5,
      "5–10 years": t5to10,
      "10+ years": t10plus,
    } = TimelineBucketEnum.enum;

    // clarify.allocation.rules.md Rule 1 — score 3 is the only branch that
    // *computes* (the cell midpoint) rather than returning a table bound, so
    // it's the only score that can produce a non-integer. The phase result
    // schema requires integer equity, so a fractional midpoint from a future
    // odd-summed cell would surface as a runtime 500. Pinning the score-3
    // midpoint for every timeline locks both the expected value and the integer
    // invariant. (Score 3 has its anchor row to itself — no 1≡2 / 4≡5 pairing.)
    it.each<{
      timeline: AllocationTimeline;
      expectedMidpoint: number;
    }>([
      { timeline: t3to5, expectedMidpoint: 25 },
      { timeline: t5to10, expectedMidpoint: 55 },
      { timeline: t10plus, expectedMidpoint: 65 },
    ])(
      "should derive midpoint $expectedMidpoint for score 3 at $timeline",
      ({ timeline, expectedMidpoint }) => {
        const range = ALLOCATION_ANCHOR_DATA[3][timeline];

        expect(deriveAnchorEquityPercentage(range, 3)).toBe(expectedMidpoint);
      },
    );

    // Scores 1 and 2 select the cell's low/high bound; scores 4 and 5 fall
    // through to the same two branches (1,4 → min; 2,5 → max), so one
    // representative per bound covers the mapping. Pinned to score 3's
    // 5–10y row (50–60), whose range is reused here only as a fixed cell.
    it.each<{ score: RiskTolerance; expected: number }>([
      { score: 1, expected: 50 },
      { score: 2, expected: 60 },
    ])("should select the cell bound for score $score", ({ score, expected }) => {
      const range = ALLOCATION_ANCHOR_DATA[3][t5to10];

      expect(deriveAnchorEquityPercentage(range, score)).toBe(expected);
    });

    // Directly exercises the rounding guard with a synthetic odd-summed cell
    // (35 + 50 = 85 → 42.5) that the current anchor table never produces.
    it("should round a fractional midpoint to the nearest integer", () => {
      const oddSumRange = { min: 35, max: 50 };

      expect(deriveAnchorEquityPercentage(oddSumRange, 3)).toBe(43);
    });
  });

  describe("resolveAllocationAnchor", () => {
    const { "5–10 years": t5to10, "10+ years": t10plus } = TimelineBucketEnum.enum;

    // The wrapper wires the table lookup to the right derivation. Two cells cover
    // both derivation paths: score 5 takes the cell's high edge, score 3 the
    // rounded midpoint. Ranges are hand-copied from ALLOCATION_ANCHOR_DATA so the
    // test fails if a lookup key ever drifts. (The full score→edge/midpoint
    // mapping is unit-tested above against deriveAnchorEquityPercentage.)
    it.each<{
      riskTolerance: RiskTolerance;
      timeline: AllocationTimeline;
      expectedRange: AllocationSuggestedEquityRange;
      expectedAnchor: number;
    }>([
      {
        riskTolerance: 5,
        timeline: t10plus,
        expectedRange: { min: 80, max: 90 },
        expectedAnchor: 90,
      },
      {
        riskTolerance: 3,
        timeline: t5to10,
        expectedRange: { min: 50, max: 60 },
        expectedAnchor: 55,
      },
    ])(
      "should resolve range $expectedRange and anchor $expectedAnchor for score $riskTolerance at $timeline",
      ({ riskTolerance, timeline, expectedRange, expectedAnchor }) => {
        expect(resolveAllocationAnchor(riskTolerance, timeline)).toEqual({
          suggestedEquityRange: expectedRange,
          anchorEquityPercentage: expectedAnchor,
        });
      },
    );
  });

  describe("computeSplit", () => {
    it("should split an amount into equity and buffer at the given percentage", () => {
      const amount = 100_000;

      expect(computeSplit(amount, 60)).toEqual({
        equityAmount: 60_000,
        bufferAmount: 40_000,
      });
    });

    // bufferAmount is the complement (amount − equityAmount), not an independent
    // amount × bufferPercentage / 100. A fractional equity (integer amount and
    // percentage still divide to a non-integer here) would let two independent
    // computations drift apart by a rounding cent; deriving buffer by subtraction
    // guarantees the two parts always sum back to the exact amount.
    it("should derive buffer as the complement so the parts sum to the amount", () => {
      const amount = 12_345;

      const { equityAmount, bufferAmount } = computeSplit(amount, 37);

      expect(equityAmount).toBeCloseTo(4567.65);
      expect(equityAmount + bufferAmount).toBe(amount);
    });
  });

  describe("selectCounterBranch", () => {
    const {
      extreme,
      "compound-impact": compoundImpact,
      bare,
    } = AllocationCounterBranchKindEnum.enum;
    const { "too-high": tooHigh, "too-low": tooLow } =
      AllocationExtremeCounterDirectionEnum.enum;

    // Fixed cell reused as a stationary suggested range; the proposals are
    // derived from the extreme threshold so the boundary cases stay honest if
    // ALLOCATION_EXTREME_DEVIATION_PERCENTAGE_POINTS moves.
    const range: AllocationSuggestedEquityRange = { min: 50, max: 60 };
    const aboveByThreshold = range.max + ALLOCATION_EXTREME_DEVIATION_PERCENTAGE_POINTS;
    const belowByThreshold = range.min - ALLOCATION_EXTREME_DEVIATION_PERCENTAGE_POINTS;
    const aboveJustUnderThreshold = aboveByThreshold - 1;
    const insideRange = 55;

    // clarify.allocation.rules.md Rule 3 — code picks the counter branch
    // deterministically from {deviation past the range, framing flags},
    // escalating once through each framing not yet shown: extreme → compound-
    // impact → bare. Each row pins one rung of that escalation. The two extreme
    // rows also pin the >= threshold boundary (exactly 40 pp out still counts)
    // and the direction recovered from a magnitude-only deviation.
    it.each<{
      name: string;
      proposedEquityPercentage: number;
      hasShownExtremeFraming: boolean;
      hasShownCompoundImpactFraming: boolean;
      expected: AllocationCounterBranch;
    }>([
      {
        name: "extreme above max at the threshold boundary, no framing shown",
        proposedEquityPercentage: aboveByThreshold,
        hasShownExtremeFraming: false,
        hasShownCompoundImpactFraming: false,
        expected: { kind: extreme, direction: tooHigh },
      },
      {
        name: "extreme below min at the threshold boundary, no framing shown",
        proposedEquityPercentage: belowByThreshold,
        hasShownExtremeFraming: false,
        hasShownCompoundImpactFraming: false,
        expected: { kind: extreme, direction: tooLow },
      },
      {
        name: "just under the threshold falls to compound-impact, not extreme",
        proposedEquityPercentage: aboveJustUnderThreshold,
        hasShownExtremeFraming: false,
        hasShownCompoundImpactFraming: false,
        expected: { kind: compoundImpact },
      },
      {
        name: "extreme deviation but extreme framing already shown → compound-impact",
        proposedEquityPercentage: aboveByThreshold,
        hasShownExtremeFraming: true,
        hasShownCompoundImpactFraming: false,
        expected: { kind: compoundImpact },
      },
      {
        name: "inside the range with no framing shown → compound-impact",
        proposedEquityPercentage: insideRange,
        hasShownExtremeFraming: false,
        hasShownCompoundImpactFraming: false,
        expected: { kind: compoundImpact },
      },
      {
        name: "non-extreme with compound-impact already shown → bare",
        proposedEquityPercentage: insideRange,
        hasShownExtremeFraming: false,
        hasShownCompoundImpactFraming: true,
        expected: { kind: bare },
      },
      {
        name: "extreme deviation with both framings already shown → bare",
        proposedEquityPercentage: aboveByThreshold,
        hasShownExtremeFraming: true,
        hasShownCompoundImpactFraming: true,
        expected: { kind: bare },
      },
    ])(
      "should select $name",
      ({
        proposedEquityPercentage,
        hasShownExtremeFraming,
        hasShownCompoundImpactFraming,
        expected,
      }) => {
        const framingFlags: AllocationFramingFlags = {
          hasShownExtremeFraming,
          hasShownCompoundImpactFraming,
        };

        expect(
          selectCounterBranch(proposedEquityPercentage, range, framingFlags),
        ).toEqual(expected);
      },
    );
  });

  describe("applyBranchFraming", () => {
    const {
      extreme,
      "compound-impact": compoundImpact,
      bare,
    } = AllocationCounterBranchKindEnum.enum;
    const { "too-high": tooHigh } = AllocationExtremeCounterDirectionEnum.enum;

    // clarify.allocation.rules.md Rule 3 — each branch flips only its own flag
    // (flags are sticky/one-way), and the other flag's incoming value is carried
    // through. The non-default incoming value on the preserved flag is the point:
    // it proves the branch doesn't reset an already-shown framing.
    it.each<{
      name: string;
      counterBranch: AllocationCounterBranch;
      framingFlags: AllocationFramingFlags;
      expected: AllocationFramingFlags;
    }>([
      {
        name: "extreme flips its flag and preserves an already-shown compound-impact",
        counterBranch: { kind: extreme, direction: tooHigh },
        framingFlags: {
          hasShownExtremeFraming: false,
          hasShownCompoundImpactFraming: true,
        },
        expected: {
          hasShownExtremeFraming: true,
          hasShownCompoundImpactFraming: true,
        },
      },
      {
        name: "compound-impact flips its flag and preserves an already-shown extreme",
        counterBranch: { kind: compoundImpact },
        framingFlags: {
          hasShownExtremeFraming: true,
          hasShownCompoundImpactFraming: false,
        },
        expected: {
          hasShownExtremeFraming: true,
          hasShownCompoundImpactFraming: true,
        },
      },
      {
        name: "bare leaves both flags unchanged",
        counterBranch: { kind: bare },
        framingFlags: {
          hasShownExtremeFraming: true,
          hasShownCompoundImpactFraming: false,
        },
        expected: {
          hasShownExtremeFraming: true,
          hasShownCompoundImpactFraming: false,
        },
      },
    ])("should map the branch so $name", ({ counterBranch, framingFlags, expected }) => {
      expect(applyBranchFraming(framingFlags, counterBranch)).toEqual(expected);
    });

    // The reason the helper builds from named fields instead of spreading: a
    // caller may pass a structurally wider value (the full negotiation state),
    // and a spread would copy its extra runtime keys into the result, which then
    // overwrite unrelated keys when the result is spread into a state patch.
    // Pin that the result carries only the two flag keys regardless of input.
    it("should return only the two flag keys when passed a wider object", () => {
      const widerState: AllocationNegotiationState = {
        hasShownExtremeFraming: false,
        hasShownCompoundImpactFraming: false,
        currentEquityPercentage: 75,
        negotiationTurnsTaken: 2,
      };
      const counterBranch: AllocationCounterBranch = {
        kind: AllocationCounterBranchKindEnum.enum.extreme,
        direction: AllocationExtremeCounterDirectionEnum.enum["too-high"],
      };

      const result = applyBranchFraming(widerState, counterBranch);

      expect(Object.keys(result).sort()).toEqual([
        "hasShownCompoundImpactFraming",
        "hasShownExtremeFraming",
      ]);
    });
  });
});
