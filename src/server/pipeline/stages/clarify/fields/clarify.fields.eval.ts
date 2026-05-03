import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { collectFields } from "#pipeline/stages/clarify/fields/clarify.fields";
import type { FieldsPhaseResult } from "#pipeline/stages/clarify/shared/clarify.types";
import { TimelineBucket } from "#schemas/pipeline.schemas";

const LAST_RUN_PATH = new URL("clarify.fields.last-run.md", import.meta.url).pathname;

describe("collectFields", () => {
  let lastTranscript: TranscriptEntry[] | undefined;
  let lastOutput: FieldsPhaseResult | undefined;

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

  // clarify.fields.rules.md: amount and timeline collected in separate turns
  it("should collect amount then timeline in separate questions", async () => {
    const responder = createTrackedResponder(["₪30,000", "about 20 years"]);
    lastTranscript = responder.transcript;

    const result = await collectFields(responder.sendToUser, responder.waitForResponse);
    lastOutput = result;

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.fields.amount).toBe(30_000);
      expect(result.fields.timeline).toBe(TimelineBucket.enum["10+ years"]);
    }
  });

  // clarify.fields.rules.md: vague timeline → re-asked before accepting
  it("should re-ask timeline when vague", async () => {
    const responder = createTrackedResponder([
      "₪20,000",
      "long-term",
      "I think 10-15 years",
    ]);
    lastTranscript = responder.transcript;

    const result = await collectFields(responder.sendToUser, responder.waitForResponse);
    lastOutput = result;

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.fields.amount).toBe(20_000);
      expect(result.fields.timeline).toBe(TimelineBucket.enum["10+ years"]);
    }
  });

  // clarify.fields.rules.md: agent presents four bucket options when asking timeline
  it("should present the four timeline bucket options when asking for timeline", async () => {
    const responder = createTrackedResponder(["₪50,000", "5-10 years"]);
    lastTranscript = responder.transcript;

    const result = await collectFields(responder.sendToUser, responder.waitForResponse);
    lastOutput = result;

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.fields.timeline).toBe(TimelineBucket.enum["5–10 years"]);
    }

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const timelineTurn = agentTurns.find((t) => /under 3 years/i.test(t.content));
    expect(timelineTurn?.content).toMatch(/3[–-]5 years/i);
    expect(timelineTurn?.content).toMatch(/5[–-]10 years/i);
    expect(timelineTurn?.content).toMatch(/10\+ years/i);
  });

  // clarify.fields.rules.md boundary mapping: exact boundary values map to shorter bucket
  it("should map exactly 3 years to 'under 3 years'", async () => {
    const responder = createTrackedResponder(["₪20,000", "3 years"]);
    lastTranscript = responder.transcript;

    const result = await collectFields(responder.sendToUser, responder.waitForResponse);
    lastOutput = result;

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.fields.timeline).toBe(TimelineBucket.enum["under 3 years"]);
    }
  });

  it("should map exactly 5 years to '3–5 years'", async () => {
    const responder = createTrackedResponder(["₪20,000", "5 years"]);
    lastTranscript = responder.transcript;

    const result = await collectFields(responder.sendToUser, responder.waitForResponse);
    lastOutput = result;

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.fields.timeline).toBe(TimelineBucket.enum["3–5 years"]);
    }
  });

  it("should map exactly 10 years to '5–10 years'", async () => {
    const responder = createTrackedResponder(["₪20,000", "10 years"]);
    lastTranscript = responder.transcript;

    const result = await collectFields(responder.sendToUser, responder.waitForResponse);
    lastOutput = result;

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.fields.timeline).toBe(TimelineBucket.enum["5–10 years"]);
    }
  });

  // clarify.fields.rules.md: amount asked twice with no number → failure
  it("should return failure when amount is never provided", async () => {
    const responder = createTrackedResponder(["I'm not sure yet", "I really don't know"]);
    lastTranscript = responder.transcript;

    const result = await collectFields(responder.sendToUser, responder.waitForResponse);
    lastOutput = result;

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.code).toBe("amount_missing");
    }
  });
});
