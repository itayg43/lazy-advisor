import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { appendLastRunEntry, initLastRun } from "#pipeline/eval.last-run";
import {
  createTrackedResponder,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { collectAmount } from "#pipeline/stages/clarify/amount/clarify.amount";
import type { AmountPhaseResult } from "#pipeline/stages/clarify/amount/clarify.amount.types";

const LAST_RUN_PATH = new URL("clarify.amount.last-run.md", import.meta.url).pathname;

describe("collectAmount", () => {
  let lastTranscript: TranscriptEntry[] | undefined;
  let lastOutput: AmountPhaseResult | undefined;

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

  // clarify.amount.rules.md rule 1: vague first attempt, specific second attempt → success
  it("should re-ask amount when answer is vague", async () => {
    const responder = createTrackedResponder(["around 20-30k", "₪25,000"]);
    lastTranscript = responder.transcript;

    const result = await collectAmount(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.amount).toBe(25_000);
    }
  });

  // clarify.amount.rules.md rule 1: k-notation shorthand normalized to integer
  it("should accept k-notation amounts", async () => {
    const responder = createTrackedResponder(["50k"]);
    lastTranscript = responder.transcript;

    const result = await collectAmount(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.amount).toBe(50_000);
    }
  });

  // clarify.amount.rules.md rule 1: amount asked twice with no number → failure
  it("should return failure when amount is never provided", async () => {
    const responder = createTrackedResponder(["I'm not sure yet", "I really don't know"]);
    lastTranscript = responder.transcript;

    const result = await collectAmount(responder);
    lastOutput = result;

    expect(result.status).toBe("unresolved");
    if (result.status === "unresolved") {
      expect(result.reason).toBe("amount");
    }

    // No clarification sent after the last user response — dead-end guard.
    expect(responder.transcript[responder.transcript.length - 1].role).toBe("user");
  });

  // clarify.amount.rules.md rule 2: deflection on amount question → redirect → success
  it("should redirect when user deflects the amount question", async () => {
    const responder = createTrackedResponder(["skip", "₪30,000"]);
    lastTranscript = responder.transcript;

    const result = await collectAmount(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.amount).toBe(30_000);
    }
  });

  // clarify.amount.rules.md rule 3: user asks a clarifying question on amount → educate + re-ask → success
  it("should answer briefly then re-ask amount when user asks a clarifying question", async () => {
    const responder = createTrackedResponder(["why do you need to know?", "₪30,000"]);
    lastTranscript = responder.transcript;

    const result = await collectAmount(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.amount).toBe(30_000);
    }
  });
});
