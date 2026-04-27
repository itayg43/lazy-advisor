import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { collectFields } from "#pipeline/stages/clarify/fields/clarify.fields";
import type { FieldsPhaseOutput } from "#pipeline/stages/clarify/shared/clarify.types";
import { TimelineBucket } from "#schemas/pipeline.schemas";

const LAST_RUN_PATH = new URL("clarify.fields.last-run.md", import.meta.url).pathname;

describe("collectFields", () => {
  let lastTranscript: TranscriptEntry[] | undefined;
  let lastOutput: FieldsPhaseOutput | undefined;

  beforeAll(() => initLastRun(LAST_RUN_PATH));

  afterEach((ctx) => {
    if (!lastTranscript) return;
    appendLastRunEntry(LAST_RUN_PATH, {
      name: ctx.task.name,
      passed: ctx.task.result?.state === "pass",
      transcript: lastTranscript,
      output: lastOutput,
      error: ctx.task.result?.errors?.[0]?.message,
    });
    lastTranscript = lastOutput = undefined;
  });

  // clarify.fields.rules.md rule 1: agent always opens with amount/age/timeline in turn 1,
  // then asks EF and debt together in turn 2.
  it("should collect all fields in exactly two turns", async () => {
    const responder = createTrackedResponder([
      "₪30,000, I'm 27, 20 years",
      "Yes emergency fund, no debt",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectFields(responder.sendToUser, responder.waitForResponse);
    lastOutput = output;

    expect(output.amount).toBe(30_000);
    expect(output.age).toBe(27);
    expect(output.timeline).toBe(TimelineBucket.enum["10+ years"]);
    expect(output.hasEmergencyFund).toBe(true);
    expect(output.hasDebt).toBe(false);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });

  // clarify.fields.rules.md rule 2: vague timeline → re-asked before moving to turn 2.
  it("should re-ask timeline when vague before proceeding to EF/debt", async () => {
    const responder = createTrackedResponder([
      "I have ₪20,000, I'm 32, long-term",
      "I guess maybe 10-15 years",
      "Yes emergency fund, no debt",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectFields(responder.sendToUser, responder.waitForResponse);
    lastOutput = output;

    expect(output.amount).toBe(20_000);
    expect(output.age).toBe(32);
    expect(output.timeline).toBe(TimelineBucket.enum["10+ years"]);
    expect(output.hasEmergencyFund).toBe(true);
    expect(output.hasDebt).toBe(false);
  });

  // clarify.fields.rules.md rule 3: when asking for timeline, agent presents the four bucket options.
  it("should present the four timeline bucket options when asking for timeline", async () => {
    const responder = createTrackedResponder([
      "₪50,000, I'm 25",
      "5-10 years",
      "Yes I have an emergency fund, no debt",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectFields(responder.sendToUser, responder.waitForResponse);
    lastOutput = output;

    expect(output.amount).toBe(50_000);
    expect(output.age).toBe(25);
    expect(output.timeline).toBe(TimelineBucket.enum["5–10 years"]);
    expect(output.hasEmergencyFund).toBe(true);
    expect(output.hasDebt).toBe(false);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const timelineTurn = agentTurns.find((t) => /under 3 years/i.test(t.content));
    expect(timelineTurn?.content).toMatch(/3[–-]5 years/i);
    expect(timelineTurn?.content).toMatch(/5[–-]10 years/i);
    expect(timelineTurn?.content).toMatch(/10\+ years/i);
  });

  // clarify.fields.rules.md rule 3: stated timeframe is mapped to nearest bucket.
  it("should map a short stated timeframe to the 'under 3 years' bucket", async () => {
    const responder = createTrackedResponder([
      "₪20,000, I'm 50, I need this money in about 2 years",
      "Yes emergency fund, no debt",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectFields(responder.sendToUser, responder.waitForResponse);
    lastOutput = output;

    expect(output.amount).toBe(20_000);
    expect(output.age).toBe(50);
    expect(output.timeline).toBe(TimelineBucket.enum["under 3 years"]);
    expect(output.hasEmergencyFund).toBe(true);
    expect(output.hasDebt).toBe(false);
  });

  // clarify.fields.rules.md rule 3: stated timeframe is mapped to nearest bucket.
  it("should map a medium stated timeframe to the '3–5 years' bucket", async () => {
    const responder = createTrackedResponder([
      "₪25,000, I'm 45, about 4-year horizon",
      "Yes emergency fund, no debt",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectFields(responder.sendToUser, responder.waitForResponse);
    lastOutput = output;

    expect(output.amount).toBe(25_000);
    expect(output.age).toBe(45);
    expect(output.timeline).toBe(TimelineBucket.enum["3–5 years"]);
    expect(output.hasEmergencyFund).toBe(true);
    expect(output.hasDebt).toBe(false);
  });
});
