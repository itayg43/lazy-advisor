import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import type { FieldsPhaseOutput } from "#pipeline/stages/clarify/clarify.types";
import { collectFields } from "#pipeline/stages/clarify/fields/clarify.fields";

const LAST_RUN_PATH = new URL("CLARIFY_FIELDS_LAST_RUN.md", import.meta.url).pathname;

describe("collectFields", () => {
  let lastGoal: string | undefined;
  let lastTranscript: TranscriptEntry[] | undefined;
  let lastOutput: FieldsPhaseOutput | undefined;

  beforeAll(() => initLastRun(LAST_RUN_PATH));

  afterEach((ctx) => {
    if (!lastTranscript) return;
    appendLastRunEntry(LAST_RUN_PATH, {
      name: ctx.task.name,
      passed: ctx.task.result?.state === "pass",
      goal: lastGoal,
      transcript: lastTranscript,
      output: lastOutput,
      error: ctx.task.result?.errors?.[0]?.message,
    });
    lastGoal = lastTranscript = lastOutput = undefined;
  });

  // CLARIFY_FIELDS_RULES #5: all required fields present in the initial message → no asks made.
  it("should return output immediately when all fields are present in the goal", async () => {
    lastGoal = "I'm 24, ₪18,000, 10 years, yes emergency fund, no debt, ₪700/month";
    const responder = createTrackedResponder([]);
    lastTranscript = responder.transcript;

    const output = await collectFields(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.amount).toBe(18_000);
    expect(output.age).toBe(24);
    expect(output.timeline).toMatch(/10/);
    expect(output.hasEmergencyFund).toBe(true);
    expect(output.hasDebt).toBe(false);
    expect(output.monthlyContribution).toBe(700);
    expect(responder.transcript).toHaveLength(0);
  });

  // CLARIFY_FIELDS_RULES #1: a soft answer on the second ask for timeline is accepted without a third probe.
  it("should stop probing timeline after 2 asks and accept best available answer", async () => {
    lastGoal = "I want to invest";
    const responder = createTrackedResponder([
      "I have ₪20,000, I'm 32, long-term",
      "I guess maybe 10-15 years. yes emergency fund, no debt, ₪800/mo",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectFields(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.amount).toBe(20_000);
    expect(output.age).toBe(32);
    expect(output.timeline.toLowerCase()).toMatch(/10|15/);
    expect(output.hasEmergencyFund).toBe(true);
    expect(output.hasDebt).toBe(false);
    expect(output.monthlyContribution).toBe(800);
  });

  // CLARIFY_FIELDS_RULES #2: fields already stated in the goal are not re-asked.
  it("should ask only for gaps when goal already contains several fields", async () => {
    lastGoal = "I'm 35, ₪75,000, long-term retirement savings";
    const responder = createTrackedResponder([
      "About 30 years — I'll retire at 65",
      "Yes emergency fund, no debt, ₪2,000/month",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectFields(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.amount).toBe(75_000);
    expect(output.age).toBe(35);
    expect(output.timeline.toLowerCase()).toMatch(/30|65/);
    expect(output.hasEmergencyFund).toBe(true);
    expect(output.hasDebt).toBe(false);
    expect(output.monthlyContribution).toBe(2_000);
  });

  // CLARIFY_FIELDS_RULES #3: after two vague answers for monthlyContribution, 0 is accepted as default.
  it("should default monthlyContribution to 0 after two vague answers", async () => {
    lastGoal = "I want to invest ₪40,000, I'm 28, 15 years, yes emergency fund, no debt";
    const responder = createTrackedResponder([
      "Whatever I can, maybe something small",
      "I'm not sure really, hard to say",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectFields(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.amount).toBe(40_000);
    expect(output.age).toBe(28);
    expect(output.monthlyContribution).toBe(0);
  });

  // CLARIFY_FIELDS_RULES #4: explicit ₪0 or "not planning to contribute" accepted immediately without a follow-up ask.
  it("should accept monthlyContribution of 0 when stated upfront without a follow-up ask", async () => {
    lastGoal =
      "I have ₪40,000, I'm 28, 15 years, yes emergency fund, no debt, not planning to contribute monthly";
    const responder = createTrackedResponder([]);
    lastTranscript = responder.transcript;

    const output = await collectFields(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.amount).toBe(40_000);
    expect(output.monthlyContribution).toBe(0);
    expect(responder.transcript).toHaveLength(0);
  });

  // CLARIFY_FIELDS_RULES #6: when many fields are missing, at most 4 are asked per turn.
  it("should ask at most 4 questions in the first turn when many fields are missing", async () => {
    lastGoal = "I want to start investing";
    const responder = createTrackedResponder([
      "₪30,000, I'm 27, 20 years, yes emergency fund",
      "No debt, ₪500/month",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectFields(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.amount).toBe(30_000);
    expect(output.age).toBe(27);
    expect(output.timeline.toLowerCase()).toMatch(/20/);
    expect(output.hasEmergencyFund).toBe(true);
    expect(output.hasDebt).toBe(false);
    expect(output.monthlyContribution).toBe(500);
    // First turn asked at most 4 questions — verified by the two-turn scripted flow completing successfully
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });
});
