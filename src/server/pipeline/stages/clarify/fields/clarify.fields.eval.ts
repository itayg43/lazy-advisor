import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { extractUserProfile } from "#pipeline/stages/clarify/extraction/clarify.extraction";
import { collectFields } from "#pipeline/stages/clarify/fields/clarify.fields";
import { KnowledgeLevel, RiskTolerance } from "#schemas/pipeline.schema";

const LAST_RUN_PATH = new URL("CLARIFY_FIELDS_LAST_RUN.md", import.meta.url).pathname;

describe("collectFields", () => {
  let lastGoal: string | undefined;
  let lastTranscript: TranscriptEntry[] | undefined;
  let lastProfile: unknown | undefined;

  beforeAll(() => initLastRun(LAST_RUN_PATH));

  afterEach((ctx) => {
    if (!lastTranscript) return;
    appendLastRunEntry(LAST_RUN_PATH, {
      name: ctx.task.name,
      passed: ctx.task.result?.state === "pass",
      goal: lastGoal,
      transcript: lastTranscript,
      profile: lastProfile,
      error: ctx.task.result?.errors?.[0]?.message,
    });
    lastGoal = lastTranscript = lastProfile = undefined;
  });

  // CLARIFY_RULES #9: stage explains why doubling in 6 months is unrealistic, redirects to long-term
  // investing, and collects all required fields once the user pivots.
  it("should handle unrealistic expectations and collect all fields after redirect", async () => {
    lastGoal = "I have ₪18,000 and I want to double it in 6 months";
    const responder = createTrackedResponder([
      "ok fine, long term then, maybe 10-15 years, moderate risk",
      "I'm 24, yes to emergency fund, no debt, maybe ₪700/mo, no brokerage, I'm in Israel, I'm a beginner",
    ]);
    lastTranscript = responder.transcript;

    const fieldsResponseId = await collectFields(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    const profile = await extractUserProfile(fieldsResponseId);
    lastProfile = profile;

    expect(profile.amount).toBe(18_000);
    expect(profile.age).toBe(24);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.monthlyContribution).toBe(700);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.brokerage).toBe("none");
  });

  // CLARIFY_RULES #4: stage redirects from out-of-scope stock picking toward ETF-based investing,
  // then collects all required fields once the user accepts.
  it("should redirect out-of-scope stock picking and collect all fields", async () => {
    lastGoal = "Should I buy NVIDIA stock?";
    const responder = createTrackedResponder([
      "ok fine, I'm open to ETFs. I have ₪30,000 to invest",
      "I'm 29, moderate risk, about 10 years, yes emergency fund, no debt, ₪1,000/mo, no brokerage, I'm in Israel, I'm a beginner",
    ]);
    lastTranscript = responder.transcript;

    const fieldsResponseId = await collectFields(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    const profile = await extractUserProfile(fieldsResponseId);
    lastProfile = profile;

    expect(profile.amount).toBe(30_000);
    expect(profile.age).toBe(29);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.monthlyContribution).toBe(1_000);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.brokerage).toBe("none");
    expect(profile.goal.toLowerCase()).toMatch(/etf|passive|invest/);
  });

  // CLARIFY_RULES #2: a soft answer on the second ask for timeline is accepted without a third probe.
  it("should stop probing timeline after 2 asks and accept best available answer", async () => {
    lastGoal = "I want to invest";
    const responder = createTrackedResponder([
      "I have ₪20,000, I'm 32, I'm in Israel, long-term",
      "I guess maybe 10-15 years. moderate risk, beginner, yes emergency fund, no debt, ₪800/mo, no brokerage",
    ]);
    lastTranscript = responder.transcript;

    const fieldsResponseId = await collectFields(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    const profile = await extractUserProfile(fieldsResponseId);
    lastProfile = profile;

    expect(profile.amount).toBe(20_000);
    expect(profile.age).toBe(32);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.monthlyContribution).toBe(800);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.timeline.toLowerCase()).toMatch(/10|15/);
  });

  // CLARIFY_RULES #12: when knowledge level is the only missing field, the agent asks for it
  // with a self-identification anchor rather than bare labels.
  it("should ask knowledge level with anchor when it is the only missing field", async () => {
    lastGoal =
      "I'm 35, I have ₪50,000 to invest, moderate risk, 15-year horizon, yes emergency fund, no debt, ₪1,500/mo, no brokerage, in Israel";
    const responder = createTrackedResponder([
      "Yes, I know what index ETFs and expense ratios are, I understand how diversification works and have been following my portfolio allocation for a year",
    ]);
    lastTranscript = responder.transcript;

    const fieldsResponseId = await collectFields(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    const profile = await extractUserProfile(fieldsResponseId);
    lastProfile = profile;

    expect(profile.amount).toBe(50_000);
    expect(profile.age).toBe(35);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.monthlyContribution).toBe(1_500);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.knowledgeLevel).toBe(KnowledgeLevel.enum.intermediate);
  });

  // CLARIFY_RULES #3: stage uses a concrete loss scenario to resolve the contradiction between
  // "max returns" and "can't lose money", then collects all remaining fields.
  it("should resolve contradictory input and collect all fields", async () => {
    lastGoal = "I want maximum returns but I can't afford to lose any money";
    const responder = createTrackedResponder([
      "If my ₪40,000 dropped to ₪32,000 I'd feel sick but hold on and wait. I guess I'm moderate.",
      "₪45,000 to invest, I'm 33, about 5 years, yes emergency fund, no debt, ₪1,000/mo, no brokerage, I'm in Israel, I'm a beginner",
    ]);
    lastTranscript = responder.transcript;

    const fieldsResponseId = await collectFields(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    const profile = await extractUserProfile(fieldsResponseId);
    lastProfile = profile;

    expect(profile.amount).toBe(45_000);
    expect(profile.age).toBe(33);
    expect([RiskTolerance.enum.moderate, RiskTolerance.enum.conservative]).toContain(
      profile.riskTolerance,
    );
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.timeline.toLowerCase()).toMatch(/5/);
  });
});
