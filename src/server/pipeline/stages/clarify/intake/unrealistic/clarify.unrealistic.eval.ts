import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { handleUnrealisticExpectations } from "#pipeline/stages/clarify/intake/unrealistic/clarify.unrealistic";

const LAST_RUN_PATH = new URL("clarify.unrealistic.last-run.md", import.meta.url)
  .pathname;

describe("handleUnrealisticExpectations", () => {
  let lastGoal: string | undefined;
  let lastTranscript: TranscriptEntry[] | undefined;

  beforeAll(() => initLastRun(LAST_RUN_PATH));

  afterEach((ctx) => {
    if (!lastTranscript) return;
    appendLastRunEntry(LAST_RUN_PATH, {
      name: ctx.task.name,
      passed: ctx.task.result?.state === "pass",
      goal: lastGoal,
      transcript: lastTranscript,
      error: ctx.task.result?.errors?.[0]?.message,
    });
    lastGoal = lastTranscript = undefined;
  });

  // clarify.unrealistic.rules.md rule 1: stage explains why the goal is unrealistic with concrete contrast,
  // and asks if the user wants to proceed with a realistic long-term plan.
  // clarify.unrealistic.rules.md rule 2: accepted — extraction returns { accepted: true, alignedGoal }.
  describe("accepted", () => {
    it("should redirect and return accepted result when user pivots to long-term", async () => {
      lastGoal = "I have ₪18,000 and I want to double it in 6 months";
      const responder = createTrackedResponder([
        "ok fine, long term then, maybe 10-15 years",
      ]);
      lastTranscript = responder.transcript;

      const result = await handleUnrealisticExpectations(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.alignedGoal).toBeTruthy();
      }
    });
  });

  // clarify.unrealistic.rules.md rule 3: rejected — extraction returns { accepted: false }.
  describe("rejected", () => {
    it("should return rejected result when user insists on unrealistic goal", async () => {
      lastGoal = "I have ₪18,000 and I want to double it in 6 months";
      const responder = createTrackedResponder([
        "No, I'm sure I can double it, I've seen people do it online",
      ]);
      lastTranscript = responder.transcript;

      const result = await handleUnrealisticExpectations(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(false);
    });
  });
});
