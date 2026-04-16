import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { extractUserProfile } from "#pipeline/stages/clarify/extraction/clarify.extraction";
import { collectFields } from "#pipeline/stages/clarify/fields/clarify.fields";
import { handleOutOfScopeRedirect } from "#pipeline/stages/clarify/intake/clarify.out-of-scope";
import { RiskTolerance } from "#schemas/pipeline.schema";

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

  // CLARIFY_RULES #4: post-intake path — collectFields receives { input: [], previous_response_id }
  // from a real out-of-scope intake and picks up context without a text prompt.
  it("should collect all fields when called with a post-intake response ID", async () => {
    lastGoal = "Should I buy NVIDIA stock?";
    const intakeResponder = createTrackedResponder(["ok fine, I'm open to ETFs"]);
    const intakeResult = await handleOutOfScopeRedirect(
      lastGoal,
      intakeResponder.sendToUser,
      intakeResponder.waitForResponse,
    );
    if (!intakeResult.accepted) throw new Error("Expected intake to be accepted");

    const fieldsResponder = createTrackedResponder([
      "I have ₪30,000, I'm 29, moderate risk, 10 years, beginner, yes emergency fund, no debt, ₪1,000/mo",
    ]);
    lastTranscript = [...intakeResponder.transcript, ...fieldsResponder.transcript];

    const fieldsResponseId = await collectFields(
      { input: [], previous_response_id: intakeResult.responseId },
      fieldsResponder.sendToUser,
      fieldsResponder.waitForResponse,
    );
    const profile = await extractUserProfile(fieldsResponseId);
    lastProfile = profile;

    expect(profile.amount).toBe(30_000);
    expect(profile.age).toBe(29);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.monthlyContribution).toBe(1_000);
  });

  // CLARIFY_RULES #2: a soft answer on the second ask for timeline is accepted without a third probe.
  it("should stop probing timeline after 2 asks and accept best available answer", async () => {
    lastGoal = "I want to invest";
    const responder = createTrackedResponder([
      "I have ₪20,000, I'm 32, I'm in Israel, long-term",
      "I guess maybe 10-15 years. moderate risk, beginner, yes emergency fund, no debt, ₪800/mo",
    ]);
    lastTranscript = responder.transcript;

    const fieldsResponseId = await collectFields(
      { input: lastGoal },
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
});
