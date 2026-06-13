import { describe, expect, it } from "vitest";

import {
  ALLOCATION_ANCHOR_DATA,
  AllocationRiskToleranceEnum,
  type AllocationRiskTolerance,
  type AllocationTimeline,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import {
  deriveAnchorEquityPercentage,
  mapRiskSelfRatingScoreToTolerance,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.lib";
import type { RiskSelfRatingScore } from "#pipeline/stages/clarify/risk/clarify.risk.types";
import { TimelineBucketEnum } from "#schemas/pipeline.schemas";

describe("clarifyAllocationLib", () => {
  const { conservative, moderate, aggressive } = AllocationRiskToleranceEnum.enum;

  describe("mapRiskSelfRatingScoreToTolerance", () => {
    // Pins the 5→3 collapse that keys the anchor table: 1–2 → conservative,
    // 3 → moderate, 4–5 → aggressive. Relocated here from the risk phase, which
    // now emits only the raw score.
    it.each<{ score: RiskSelfRatingScore; expected: AllocationRiskTolerance }>([
      { score: 1, expected: conservative },
      { score: 2, expected: conservative },
      { score: 3, expected: moderate },
      { score: 4, expected: aggressive },
      { score: 5, expected: aggressive },
    ])("should map score $score to $expected", ({ score, expected }) => {
      expect(mapRiskSelfRatingScoreToTolerance(score)).toBe(expected);
    });
  });

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
    // odd-summed cell would surface as a runtime 500. Pinning every current
    // midpoint locks both the expected value and the integer invariant.
    it.each<{
      riskTolerance: AllocationRiskTolerance;
      timeline: AllocationTimeline;
      expectedMidpoint: number;
    }>([
      { riskTolerance: conservative, timeline: t3to5, expectedMidpoint: 15 },
      { riskTolerance: conservative, timeline: t5to10, expectedMidpoint: 35 },
      { riskTolerance: conservative, timeline: t10plus, expectedMidpoint: 45 },
      { riskTolerance: moderate, timeline: t3to5, expectedMidpoint: 25 },
      { riskTolerance: moderate, timeline: t5to10, expectedMidpoint: 55 },
      { riskTolerance: moderate, timeline: t10plus, expectedMidpoint: 65 },
      { riskTolerance: aggressive, timeline: t3to5, expectedMidpoint: 35 },
      { riskTolerance: aggressive, timeline: t5to10, expectedMidpoint: 65 },
      { riskTolerance: aggressive, timeline: t10plus, expectedMidpoint: 85 },
    ])(
      "should derive midpoint $expectedMidpoint for score 3 at $riskTolerance / $timeline",
      ({ riskTolerance, timeline, expectedMidpoint }) => {
        const range = ALLOCATION_ANCHOR_DATA[riskTolerance][timeline];

        expect(deriveAnchorEquityPercentage(range, 3)).toBe(expectedMidpoint);
      },
    );

    // Scores 1 and 2 select the cell's low/high bound; scores 4 and 5 fall
    // through to the same two branches (1,4 → min; 2,5 → max), so one
    // representative per bound covers the mapping. Pinned to the moderate
    // 5–10y cell (50–60).
    it.each<{ score: RiskSelfRatingScore; expected: number }>([
      { score: 1, expected: 50 },
      { score: 2, expected: 60 },
    ])("should select the cell bound for score $score", ({ score, expected }) => {
      const range = ALLOCATION_ANCHOR_DATA[moderate][t5to10];

      expect(deriveAnchorEquityPercentage(range, score)).toBe(expected);
    });

    // Directly exercises the rounding guard with a synthetic odd-summed cell
    // (35 + 50 = 85 → 42.5) that the current anchor table never produces.
    it("should round a fractional midpoint to the nearest integer", () => {
      const oddSumRange = { min: 35, max: 50 };

      expect(deriveAnchorEquityPercentage(oddSumRange, 3)).toBe(43);
    });
  });
});
