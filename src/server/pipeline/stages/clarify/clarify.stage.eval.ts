import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { runClarifyStage } from "#pipeline/stages/clarify/clarify.stage";
import { RiskTolerance, UserProfileSchema } from "#schemas/pipeline.schema";

const LAST_RUN_PATH = new URL("clarify.stage.last-run.md", import.meta.url).pathname;

describe("clarifyStage", () => {
  let lastGoal: string | undefined;
  let lastTranscript: TranscriptEntry[] | undefined;
  let lastProfile: unknown | undefined;

  const assertValidProfile = (profile: unknown): void => {
    const result = UserProfileSchema.safeParse(profile);
    expect(result.success).toBe(true);
  };

  beforeAll(() => initLastRun(LAST_RUN_PATH));

  afterEach((ctx) => {
    if (!lastTranscript) return;
    appendLastRunEntry(LAST_RUN_PATH, {
      name: ctx.task.name,
      passed: !ctx.task.result?.errors?.length,
      durationMs: ctx.task.result?.duration ?? 0,
      goal: lastGoal,
      transcript: lastTranscript,
      profile: lastProfile,
    });
    lastGoal = lastTranscript = lastProfile = undefined;
  });

  // Story 4: tests redirect on unrealistic expectation and valid profile extraction after user pivots.
  it("should handle unrealistic expectations and extract profile after redirect", async () => {
    lastGoal = "I have ₪18,000 and I want to double it in 6 months";
    const responder = createTrackedResponder([
      "ok fine, long term then, maybe 10-15 years, moderate risk",
      "I'm 24, yes to emergency fund, no debt, maybe ₪700/mo, no brokerage, I'm in Israel, I'm a beginner",
    ]);

    const profile = await runClarifyStage(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastTranscript = responder.transcript;
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(18_000);
    expect(profile.age).toBe(24);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.monthlyContribution).toBe(700);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.brokerage).toBe("none");
  });

  // Story 5: tests redirect from out-of-scope stock picking toward ETF-based investing with valid profile.
  it("should redirect out-of-scope stock picking toward ETF-based investing", async () => {
    lastGoal = "Should I buy NVIDIA stock?";
    const responder = createTrackedResponder([
      "ok fine, I'm open to ETFs. I have ₪30,000 to invest",
      "I'm 29, moderate risk, about 10 years, yes emergency fund, no debt, ₪1,000/mo, no brokerage, I'm in Israel, I'm a beginner",
    ]);

    const profile = await runClarifyStage(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastTranscript = responder.transcript;
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(30_000);
    expect(profile.age).toBe(29);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.monthlyContribution).toBe(1_000);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.brokerage).toBe("none");
    expect(profile.goal.toLowerCase()).toMatch(/etf|passive|invest/);
  });

  // Story 7 variant: tests that a soft answer on the second ask is accepted without a third probe.
  // A third response is needed for the portfolio defaults question that follows once all required fields pass.
  it("should stop probing timeline after 2 asks", async () => {
    lastGoal = "I want to invest";
    const responder = createTrackedResponder([
      "I have ₪20,000, I'm 32, I'm in Israel, long-term",
      "I guess maybe 10-15 years. moderate risk, beginner, yes emergency fund, no debt, ₪800/mo, no brokerage",
      "100% FTSE All-World. קרן כספית for the buffer.",
    ]);

    const profile = await runClarifyStage(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastTranscript = responder.transcript;
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(20_000);
    expect(profile.age).toBe(32);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.monthlyContribution).toBe(800);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.timeline.toLowerCase()).toMatch(/10|15/);
  });

  // Story 8: tests contradiction resolution through conversation and correct risk tolerance extraction.
  it("should resolve contradictory input and extract correct risk tolerance", async () => {
    lastGoal = "I want maximum returns but I can't afford to lose any money";
    const responder = createTrackedResponder([
      "If my ₪40,000 dropped to ₪32,000 I'd feel sick but hold on and wait. I guess I'm moderate.",
      "₪45,000 to invest, I'm 33, about 5 years, yes emergency fund, no debt, ₪1,000/mo, no brokerage, I'm in Israel, I'm a beginner",
    ]);

    const profile = await runClarifyStage(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastTranscript = responder.transcript;
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(45_000);
    expect(profile.age).toBe(33);
    expect([RiskTolerance.enum.moderate, RiskTolerance.enum.conservative]).toContain(
      profile.riskTolerance,
    );
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
  });

  // Story 1 (portfolio defaults): tests that when investmentPreferences is "none", the stage asks the
  // portfolio defaults question and captures the user's equity allocation + buffer answers.
  it("should ask portfolio defaults question and capture answers when no preferences stated", async () => {
    lastGoal =
      "I have ₪55,000 and I want to start investing but I have no idea where to begin";
    const responder = createTrackedResponder([
      "I'm 28, yes 6 months emergency fund, no debt, about 20 years, a 20% drop would stress me but I wouldn't sell, ₪1,800/mo, no brokerage, I'm in Israel, I'm a complete beginner",
      "70% FTSE All-World and 30% TLV-125. קרן כספית sounds right for the buffer.",
    ]);

    const profile = await runClarifyStage(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastTranscript = responder.transcript;
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(55_000);
    expect(profile.age).toBe(28);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.monthlyContribution).toBe(1_800);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.brokerage).toBe("none");
    expect(profile.investmentPreferences).not.toBe("none");
    expect(profile.investmentPreferences.toLowerCase()).toMatch(
      /ftse|all.world|world|global/i,
    );
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/tlv/i);
    expect(profile.investmentPreferences).toMatch(/\d+%/);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/כספית|money market/i);
  });

  // Story 12a: tests that a single instrument preference mentioned in the goal is captured.
  it("should capture single instrument preference from goal", async () => {
    lastGoal = "I have ₪100,000 and I want to invest in tech sector ETFs";
    const responder = createTrackedResponder([
      "I'm 31, Israel, moderate risk, about 15 years, intermediate, yes emergency fund, no debt, ₪2,500/mo, no brokerage",
    ]);

    const profile = await runClarifyStage(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastTranscript = responder.transcript;
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(100_000);
    expect(profile.age).toBe(31);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.monthlyContribution).toBe(2_500);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/tech/);
  });

  // Story 12b: tests that when multiple instruments are named without a split, the stage asks for
  // a percentage allocation and captures it in investmentPreferences.
  it("should ask for percentage split when multiple instruments are named and capture it", async () => {
    lastGoal =
      "I have ₪100,000 and I want to invest mainly in S&P 500 and TLV-125 index funds";
    const responder = createTrackedResponder([
      "I'm 31, Israel, moderate risk, about 15 years, intermediate, yes emergency fund, no debt, ₪2,500/mo, no brokerage",
      "70% S&P 500 and 30% TLV-125",
    ]);

    const profile = await runClarifyStage(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastTranscript = responder.transcript;
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(100_000);
    expect(profile.age).toBe(31);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/s&p 500|sp500/i);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/tlv/i);
    expect(profile.investmentPreferences).toMatch(/\d+%/);
  });
});
