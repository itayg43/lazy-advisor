import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { appendLastRunEntry, initLastRun } from "#pipeline/eval.transcript";
import { buildAllocationPlan } from "#pipeline/stages/research/research.allocation";
import { AllocationPlanSchema } from "#schemas/pipeline.schema";
import type { AllocationPlan, UserProfile } from "#types/pipeline.types";

const LAST_RUN_PATH = new URL("RESEARCH_ALLOCATION_LAST_RUN.md", import.meta.url)
  .pathname;

const BOND_KEYWORDS = [
  "bond",
  "fixed",
  "שחר",
  "אגח",
  "aggregate",
  "money market",
  "כספית",
];

describe("researchAllocation", () => {
  let lastInputProfile: UserProfile | undefined;
  let lastPlan: AllocationPlan | undefined;

  beforeAll(() => initLastRun(LAST_RUN_PATH));

  afterEach((ctx) => {
    if (!lastInputProfile) return;
    appendLastRunEntry(LAST_RUN_PATH, {
      name: ctx.task.name,
      passed: ctx.task.result?.state === "pass",
      goal: lastInputProfile.goal,
      transcript: [],
      output: lastPlan,
      error: ctx.task.result?.errors?.[0]?.message,
    });
    lastInputProfile = lastPlan = undefined;
  });

  const assertValidPlan = (plan: unknown): void => {
    const result = AllocationPlanSchema.safeParse(plan);
    expect(result.success).toBe(true);
  };

  const isBondSlice = (category: string): boolean =>
    BOND_KEYWORDS.some((kw) => category.toLowerCase().includes(kw));

  const totalBondPercentage = (plan: AllocationPlan): number =>
    plan.slices
      .filter((s) => isBondSlice(s.category))
      .reduce((sum, s) => sum + s.percentage, 0);

  // RESEARCH_EXAMPLES #1: 28yo moderate investor with emergency fund, 70% FTSE All-World + 30% TLV-125.
  // Young + emergency fund → bonds should be reduced or absent.
  it("should reduce bonds for young moderate investor with emergency fund", async () => {
    const profile: UserProfile = {
      goal: "invest ₪55,000 as a complete beginner, moderate risk, 20-year horizon with ₪1,800/month contributions",
      amount: 55_000,
      age: 28,
      riskTolerance: "moderate",
      timeline: "20 years",
      investmentPreferences: "70% FTSE All-World, 30% TLV-125, קרן כספית buffer",
      hasEmergencyFund: true,
      hasDebt: false,
      monthlyContribution: 1_800,
    };

    lastInputProfile = profile;
    const plan = await buildAllocationPlan(profile);
    lastPlan = plan;

    assertValidPlan(plan);
    expect(totalBondPercentage(plan)).toBeLessThanOrEqual(20);
  });

  // RESEARCH_EXAMPLES #2: 25yo aggressive investor with emergency fund, 100% NASDAQ — no buffer.
  // Young + aggressive + emergency fund + explicit no-buffer → bonds should be minimal or absent.
  it("should produce minimal or no bonds for young aggressive investor with emergency fund", async () => {
    const profile: UserProfile = {
      goal: "aggressive growth portfolio, ₪35,000 over 20+ years",
      amount: 35_000,
      age: 25,
      riskTolerance: "aggressive",
      timeline: "20+ years",
      investmentPreferences:
        "100% NASDAQ — no buffer; emergency fund held separately outside portfolio",
      hasEmergencyFund: true,
      hasDebt: false,
      monthlyContribution: 1_500,
    };

    lastInputProfile = profile;
    const plan = await buildAllocationPlan(profile);
    lastPlan = plan;

    assertValidPlan(plan);
    expect(totalBondPercentage(plan)).toBeLessThanOrEqual(10);
  });

  // RESEARCH_EXAMPLES #3: older conservative investor (58yo) with emergency fund, 60% MSCI World + 40% קרן כספית.
  // Age > 50 → bonds must be present regardless of emergency fund.
  it("should keep bonds for older investor even with emergency fund", async () => {
    const profile: UserProfile = {
      goal: "invest ₪200,000 conservatively for retirement in 10 years",
      amount: 200_000,
      age: 58,
      riskTolerance: "conservative",
      timeline: "10 years",
      investmentPreferences: "60% MSCI World, 40% קרן כספית",
      hasEmergencyFund: true,
      hasDebt: false,
      monthlyContribution: 3_000,
    };

    lastInputProfile = profile;
    const plan = await buildAllocationPlan(profile);
    lastPlan = plan;

    assertValidPlan(plan);
    expect(totalBondPercentage(plan)).toBeGreaterThan(0);
  });

  // RESEARCH_EXAMPLES #4: 32yo moderate investor with explicit 80/20 split between S&P 500 and TLV-125.
  // Stated preferences with percentages → dedicated slices at the exact stated percentages.
  it("should produce dedicated slices at stated percentages for multiple preferences", async () => {
    const profile: UserProfile = {
      goal: "invest ₪100,000 with a 15-year horizon, 80% S&P 500 and 20% TLV-125",
      amount: 100_000,
      age: 32,
      riskTolerance: "moderate",
      timeline: "15 years",
      investmentPreferences: "80% S&P 500, 20% TLV-125",
      hasEmergencyFund: true,
      hasDebt: false,
      monthlyContribution: 2_500,
    };

    lastInputProfile = profile;
    const plan = await buildAllocationPlan(profile);
    lastPlan = plan;
    const sp500Slice = plan.slices.find((s) =>
      s.category.toLowerCase().match(/s&p 500|sp500/),
    );
    const tlvSlice = plan.slices.find((s) => s.category.toLowerCase().includes("tlv"));

    assertValidPlan(plan);
    expect(sp500Slice).toBeDefined();
    expect(tlvSlice).toBeDefined();
    expect(sp500Slice?.percentage).toBe(80);
    expect(tlvSlice?.percentage).toBe(20);
  });
});
