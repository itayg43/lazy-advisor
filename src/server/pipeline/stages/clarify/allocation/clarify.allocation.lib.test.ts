import { describe, expect, it } from "vitest";

import {
  ALLOCATION_ANCHOR_DATA,
  type AllocationTimeline,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import { deriveAnchorEquityPercentage } from "#pipeline/stages/clarify/allocation/clarify.allocation.lib";
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
});
