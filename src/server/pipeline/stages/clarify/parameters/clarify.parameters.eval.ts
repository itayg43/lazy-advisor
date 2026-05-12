import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { collectParameters } from "#pipeline/stages/clarify/parameters/clarify.parameters";
import type { ParametersPhaseResult } from "#pipeline/stages/clarify/parameters/clarify.parameters.types";
import { TimelineBucketEnum } from "#schemas/pipeline.schemas";

const LAST_RUN_PATH = new URL("clarify.parameters.last-run.md", import.meta.url).pathname;

describe("collectParameters", () => {
  let lastTranscript: TranscriptEntry[] | undefined;
  let lastOutput: ParametersPhaseResult | undefined;

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

  // clarify.parameters.rules.md rule 1: amount and timeline collected in separate turns
  it("should collect amount then timeline in separate questions", async () => {
    const responder = createTrackedResponder(["₪30,000", "about 20 years"]);
    lastTranscript = responder.transcript;

    const result = await collectParameters(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.amount).toBe(30_000);
      expect(result.timeline).toBe(TimelineBucketEnum.enum["10+ years"]);
    }
  });

  // clarify.parameters.rules.md rule 1: k-notation shorthand parsed to integer
  it("should accept k-notation amounts", async () => {
    const responder = createTrackedResponder(["50k", "5-10 years"]);
    lastTranscript = responder.transcript;

    const result = await collectParameters(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.amount).toBe(50_000);
      expect(result.timeline).toBe(TimelineBucketEnum.enum["5–10 years"]);
    }
  });

  // clarify.parameters.rules.md rule 2: vague first attempt, valid second attempt → success
  it("should re-ask timeline when vague", async () => {
    const responder = createTrackedResponder([
      "₪20,000",
      "long-term",
      "I think 10-15 years",
    ]);
    lastTranscript = responder.transcript;

    const result = await collectParameters(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.amount).toBe(20_000);
      expect(result.timeline).toBe(TimelineBucketEnum.enum["10+ years"]);
    }
  });

  // clarify.parameters.rules.md rule 2: timeline asked twice with no valid answer → failure
  it("should return failure when timeline is never provided", async () => {
    const responder = createTrackedResponder([
      "₪40,000",
      "I have no idea",
      "I really can't say",
    ]);
    lastTranscript = responder.transcript;

    const result = await collectParameters(responder);
    lastOutput = result;

    expect(result.status).toBe("unresolved");
    if (result.status === "unresolved") {
      expect(result.reason).toBe("timeline");
    }

    // No clarification sent after the last user response — dead-end guard.
    expect(responder.transcript[responder.transcript.length - 1].role).toBe("user");
  });

  // clarify.parameters.rules.md rule 3: agent presents four bucket options when asking timeline
  it("should present the four timeline bucket options when asking for timeline", async () => {
    const responder = createTrackedResponder(["₪50,000", "5-10 years"]);
    lastTranscript = responder.transcript;

    const result = await collectParameters(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.timeline).toBe(TimelineBucketEnum.enum["5–10 years"]);
    }

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const timelineTurn = agentTurns.find((t) => /under 3 years/i.test(t.content));
    expect(timelineTurn?.content).toMatch(/3[–-]5 years/i);
    expect(timelineTurn?.content).toMatch(/5[–-]10 years/i);
    expect(timelineTurn?.content).toMatch(/10\+ years/i);
  });

  // clarify.parameters.rules.md rule 3: exact boundary values map to shorter bucket
  it("should map exactly 3 years to 'under 3 years'", async () => {
    const responder = createTrackedResponder(["₪20,000", "3 years"]);
    lastTranscript = responder.transcript;

    const result = await collectParameters(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.timeline).toBe(TimelineBucketEnum.enum["under 3 years"]);
    }
  });

  // clarify.parameters.rules.md rule 3: exact boundary values map to shorter bucket
  it("should map exactly 5 years to '3–5 years'", async () => {
    const responder = createTrackedResponder(["₪20,000", "5 years"]);
    lastTranscript = responder.transcript;

    const result = await collectParameters(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.timeline).toBe(TimelineBucketEnum.enum["3–5 years"]);
    }
  });

  // clarify.parameters.rules.md rule 3: exact boundary values map to shorter bucket
  it("should map exactly 10 years to '5–10 years'", async () => {
    const responder = createTrackedResponder(["₪20,000", "10 years"]);
    lastTranscript = responder.transcript;

    const result = await collectParameters(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.timeline).toBe(TimelineBucketEnum.enum["5–10 years"]);
    }
  });

  // clarify.parameters.rules.md rule 4: vague first attempt, specific second attempt → success
  it("should re-ask amount when answer is vague", async () => {
    const responder = createTrackedResponder(["around 20-30k", "₪25,000", "10+ years"]);
    lastTranscript = responder.transcript;

    const result = await collectParameters(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.amount).toBe(25_000);
      expect(result.timeline).toBe(TimelineBucketEnum.enum["10+ years"]);
    }
  });

  // clarify.parameters.rules.md rule 4: amount asked twice with no number → failure
  it("should return failure when amount is never provided", async () => {
    const responder = createTrackedResponder(["I'm not sure yet", "I really don't know"]);
    lastTranscript = responder.transcript;

    const result = await collectParameters(responder);
    lastOutput = result;

    expect(result.status).toBe("unresolved");
    if (result.status === "unresolved") {
      expect(result.reason).toBe("amount");
    }

    // No clarification sent after the last user response — dead-end guard.
    expect(responder.transcript[responder.transcript.length - 1].role).toBe("user");
  });

  // clarify.parameters.rules.md rule 5: deflection treated as non-answer → redirect → success
  it("should redirect when user deflects the timeline question", async () => {
    const responder = createTrackedResponder(["₪30,000", "skip", "5-10 years"]);
    lastTranscript = responder.transcript;

    const result = await collectParameters(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.amount).toBe(30_000);
      expect(result.timeline).toBe(TimelineBucketEnum.enum["5–10 years"]);
    }
  });

  // clarify.parameters.rules.md rule 5: deflection on amount question → redirect → success
  it("should redirect when user deflects the amount question", async () => {
    const responder = createTrackedResponder(["skip", "₪30,000", "5-10 years"]);
    lastTranscript = responder.transcript;

    const result = await collectParameters(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.amount).toBe(30_000);
      expect(result.timeline).toBe(TimelineBucketEnum.enum["5–10 years"]);
    }
  });
});
