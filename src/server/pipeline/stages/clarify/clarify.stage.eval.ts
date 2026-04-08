import { describe, expect, it } from "vitest";

import { runClarifyStage } from "#pipeline/stages/clarify/clarify.stage";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { RiskTolerance, UserProfileSchema } from "#schemas/pipeline.schema";

type ScriptedResponder = {
  sendToUser: SendToUser;
  waitForResponse: WaitForResponse;
};

describe("clarifyStage", () => {
  const assertValidProfile = (profile: unknown): void => {
    const result = UserProfileSchema.safeParse(profile);
    expect(result.success).toBe(true);
  };

  const createScriptedResponder = (responses: string[]): ScriptedResponder => {
    let responseIndex = 0;

    return {
      sendToUser: () => {},
      waitForResponse: () => {
        const response = responses[responseIndex] ?? "that's all I have";
        responseIndex++;

        return Promise.resolve(response);
      },
    };
  };

  // Story 4: tests redirect on unrealistic expectation and valid profile extraction after user pivots.
  it("should handle unrealistic expectations and extract profile after redirect", async () => {
    const responder = createScriptedResponder([
      "ok fine, long term then, maybe 10-15 years, moderate risk",
      "I'm 24, yes to emergency fund, no debt, maybe ₪700/mo, no brokerage, I'm in Israel, I'm a beginner",
    ]);

    const profile = await runClarifyStage(
      "I have ₪18,000 and I want to double it in 6 months",
      responder.sendToUser,
      responder.waitForResponse,
    );

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
    const responder = createScriptedResponder([
      "ok fine, I'm open to ETFs. I have ₪30,000 to invest",
      "I'm 29, moderate risk, about 10 years, yes emergency fund, no debt, ₪1,000/mo, no brokerage, I'm in Israel, I'm a beginner",
    ]);

    const profile = await runClarifyStage(
      "Should I buy NVIDIA stock?",
      responder.sendToUser,
      responder.waitForResponse,
    );

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
  it("should stop probing timeline after 2 asks", async () => {
    const responder = createScriptedResponder([
      "I have ₪20,000, I'm 32, I'm in Israel, long-term",
      "I guess maybe 10-15 years. moderate risk, beginner, yes emergency fund, no debt, ₪800/mo, no brokerage",
    ]);

    const profile = await runClarifyStage(
      "I want to invest",
      responder.sendToUser,
      responder.waitForResponse,
    );

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
    const responder = createScriptedResponder([
      "If my ₪40,000 dropped to ₪32,000 I'd feel sick but hold on and wait. I guess I'm moderate.",
      "₪45,000 to invest, I'm 33, about 5 years, yes emergency fund, no debt, ₪1,000/mo, no brokerage, I'm in Israel, I'm a beginner",
    ]);

    const profile = await runClarifyStage(
      "I want maximum returns but I can't afford to lose any money",
      responder.sendToUser,
      responder.waitForResponse,
    );

    assertValidProfile(profile);
    expect(profile.amount).toBe(45_000);
    expect(profile.age).toBe(33);
    expect([RiskTolerance.enum.moderate, RiskTolerance.enum.conservative]).toContain(
      profile.riskTolerance,
    );
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
  });

  // Story 12a: tests that a single instrument preference mentioned in the goal is captured.
  it("should capture single instrument preference from goal", async () => {
    const responder = createScriptedResponder([
      "I'm 31, Israel, moderate risk, about 15 years, intermediate, yes emergency fund, no debt, ₪2,500/mo, no brokerage",
    ]);

    const profile = await runClarifyStage(
      "I have ₪100,000 and I want to invest in tech sector ETFs",
      responder.sendToUser,
      responder.waitForResponse,
    );

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
    const responder = createScriptedResponder([
      "I'm 31, Israel, moderate risk, about 15 years, intermediate, yes emergency fund, no debt, ₪2,500/mo, no brokerage",
      "70% S&P 500 and 30% TLV-125",
    ]);

    const profile = await runClarifyStage(
      "I have ₪100,000 and I want to invest mainly in S&P 500 and TLV-125 index funds",
      responder.sendToUser,
      responder.waitForResponse,
    );

    assertValidProfile(profile);
    expect(profile.amount).toBe(100_000);
    expect(profile.age).toBe(31);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/s&p 500|sp500/i);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/tlv/i);
    expect(profile.investmentPreferences).toMatch(/\d+%/);
  });
});
