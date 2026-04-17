import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { runClarifyStage } from "#pipeline/stages/clarify/clarify.stage";
import { RiskTolerance } from "#schemas/pipeline.schema";

const LAST_RUN_PATH = new URL("CLARIFY_STAGE_LAST_RUN.md", import.meta.url).pathname;

describe("runClarifyStage", () => {
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
      output: lastProfile,
      error: ctx.task.result?.errors?.[0]?.message,
    });
    lastGoal = lastTranscript = lastProfile = undefined;
  });

  // Normal goal — no intake phase, full profile extracted.
  it("should produce a full profile for a normal goal", async () => {
    lastGoal = "I have ₪55,000 to invest, I'm 28, moderate risk, 20 years, beginner";
    const responder = createTrackedResponder([
      "yes emergency fund, no debt, ₪1,800/mo",
      "Yes, I plan to add money every month",
      "FTSE All-World mostly. קרן כספית for the buffer.",
    ]);
    lastTranscript = responder.transcript;

    const result = await runClarifyStage(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastProfile = result;

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.amount).toBe(55_000);
    expect(result.age).toBe(28);
    expect(result.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(result.hasEmergencyFund).toBe(true);
    expect(result.hasDebt).toBe(false);
  });

  // CLARIFY_RULES #3: out-of-scope goal → redirect → user accepts → full profile extracted.
  it("should redirect out-of-scope goal and produce a full profile after acceptance", async () => {
    lastGoal = "Should I buy NVIDIA stock?";
    const responder = createTrackedResponder([
      "ok fine, I'm open to ETFs. I have ₪30,000, I'm 29, moderate risk, 10 years",
      "yes emergency fund, no debt, ₪1,000/mo, beginner",
      "Yes, I plan to add money every month",
      "S&P 500. קרן כספית for the buffer.",
    ]);
    lastTranscript = responder.transcript;

    const result = await runClarifyStage(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastProfile = result;

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.amount).toBe(30_000);
    expect(result.age).toBe(29);
    expect(result.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(result.goal.toLowerCase()).toMatch(/etf|invest/);
  });

  // Rejection path — user declines redirect, stage ends without a profile.
  it("should return null when user rejects the intake redirect", async () => {
    lastGoal = "Should I buy NVIDIA stock?";
    const responder = createTrackedResponder([
      "No, I only want NVIDIA, not interested in ETFs at all",
    ]);
    lastTranscript = responder.transcript;

    const result = await runClarifyStage(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastProfile = result;

    expect(result).toBeNull();
  });
});
