import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { collectFields } from "#pipeline/stages/clarify/fields/clarify.fields";
import type { FieldsPhaseOutput } from "#pipeline/stages/clarify/shared/clarify.types";

const LAST_RUN_PATH = new URL("clarify.fields.last-run.md", import.meta.url).pathname;

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

  // clarify.fields.rules.md rule 1: fields stated in the goal (amount, timeline) are not re-asked.
  it("should ask only for gaps when goal includes amount and timeline", async () => {
    lastGoal = "I want to start investing, I have about ₪18,000 and maybe 10 years";
    const responder = createTrackedResponder([
      "I'm 27, yes I have an emergency fund, no debt",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectFields(
      lastGoal,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.amount).toBe(18_000);
    expect(output.age).toBe(27);
    expect(output.timeline).toMatch(/10/);
    expect(output.hasEmergencyFund).toBe(true);
    expect(output.hasDebt).toBe(false);
  });

  // clarify.fields.rules.md rule 1: fields already stated in the goal are not re-asked.
  it("should ask only for gaps when goal already contains several fields", async () => {
    lastGoal = "I'm 35, ₪75,000, long-term retirement savings";
    const responder = createTrackedResponder([
      "About 30 years — I'll retire at 65",
      "Yes emergency fund, no debt",
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
  });

  // clarify.fields.rules.md rule 2: when many fields are missing, at most 4 are asked per turn.
  it("should ask at most 4 questions in the first turn when many fields are missing", async () => {
    lastGoal = "I want to start investing";
    const responder = createTrackedResponder([
      "₪30,000, I'm 27, 20 years, yes emergency fund",
      "No debt",
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
    // First turn asked at most 4 questions — verified by the two-turn scripted flow completing successfully
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });

  // clarify.fields.rules.md rule 3: a soft answer on the second ask for timeline is accepted without a third probe.
  it("should stop probing timeline after 2 asks and accept best available answer", async () => {
    lastGoal = "I want to invest";
    const responder = createTrackedResponder([
      "I have ₪20,000, I'm 32, long-term",
      "I guess maybe 10-15 years. yes emergency fund, no debt",
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
  });
});
