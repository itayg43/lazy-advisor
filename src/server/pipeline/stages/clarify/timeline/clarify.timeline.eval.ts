import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { appendLastRunEntry, initLastRun } from "#pipeline/eval.last-run";
import {
  createTrackedResponder,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { collectTimeline } from "#pipeline/stages/clarify/timeline/clarify.timeline";
import type { TimelinePhaseResult } from "#pipeline/stages/clarify/timeline/clarify.timeline.types";
import { TimelineBucketEnum } from "#schemas/pipeline.schemas";

const LAST_RUN_PATH = new URL("clarify.timeline.last-run.md", import.meta.url).pathname;

describe("collectTimeline", () => {
  let lastTranscript: TranscriptEntry[] | undefined;
  let lastOutput: TimelinePhaseResult | undefined;

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

  // clarify.timeline.rules.md rule 1: approximate timeframe phrasing maps to the nearest bucket
  it("should map approximate timeframe phrasing to correct bucket", async () => {
    const responder = createTrackedResponder(["about 20 years"]);
    lastTranscript = responder.transcript;

    const result = await collectTimeline(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.timeline).toBe(TimelineBucketEnum.enum["10+ years"]);
    }
  });

  // clarify.timeline.rules.md rule 1: agent presents four bucket options when asking timeline
  it("should present the four timeline bucket options when asking for timeline", async () => {
    const responder = createTrackedResponder(["5-10 years"]);
    lastTranscript = responder.transcript;

    const result = await collectTimeline(responder);
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

  // clarify.timeline.rules.md rule 1: exact boundary values map to shorter bucket
  it.each([
    { input: "3 years", expected: TimelineBucketEnum.enum["under 3 years"] },
    { input: "5 years", expected: TimelineBucketEnum.enum["3–5 years"] },
    { input: "10 years", expected: TimelineBucketEnum.enum["5–10 years"] },
  ])("should map exactly $input to $expected", async ({ input, expected }) => {
    const responder = createTrackedResponder([input]);
    lastTranscript = responder.transcript;

    const result = await collectTimeline(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.timeline).toBe(expected);
    }
  });

  // clarify.timeline.rules.md rule 1: vague first attempt, valid second attempt → success
  it("should re-ask timeline when vague", async () => {
    const responder = createTrackedResponder(["long-term", "I think 10-15 years"]);
    lastTranscript = responder.transcript;

    const result = await collectTimeline(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.timeline).toBe(TimelineBucketEnum.enum["10+ years"]);
    }
  });

  // clarify.timeline.rules.md rule 1: timeline asked twice with no valid answer → failure
  it("should return failure when timeline is never provided", async () => {
    const responder = createTrackedResponder(["I have no idea", "I really can't say"]);
    lastTranscript = responder.transcript;

    const result = await collectTimeline(responder);
    lastOutput = result;

    expect(result.status).toBe("unresolved");
    if (result.status === "unresolved") {
      expect(result.reason).toBe("timeline");
    }

    // No clarification sent after the last user response — dead-end guard.
    expect(responder.transcript[responder.transcript.length - 1].role).toBe("user");
  });

  // clarify.timeline.rules.md rule 2: deflection on timeline question → redirect → success
  it("should redirect when user deflects the timeline question", async () => {
    const responder = createTrackedResponder(["skip", "5-10 years"]);
    lastTranscript = responder.transcript;

    const result = await collectTimeline(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.timeline).toBe(TimelineBucketEnum.enum["5–10 years"]);
    }
  });

  // clarify.timeline.rules.md rule 3: user asks a clarifying question on timeline → educate + re-ask → success
  it("should answer briefly then re-ask timeline when user asks a clarifying question", async () => {
    const responder = createTrackedResponder(["why does this matter?", "5-10 years"]);
    lastTranscript = responder.transcript;

    const result = await collectTimeline(responder);
    lastOutput = result;

    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.timeline).toBe(TimelineBucketEnum.enum["5–10 years"]);
    }
  });
});
