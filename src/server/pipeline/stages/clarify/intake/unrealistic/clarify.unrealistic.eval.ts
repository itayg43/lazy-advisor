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
  // clarify.unrealistic.rules.md rule 2: accepted — extraction returns { accepted: true }.
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
    });

    // clarify.unrealistic.rules.md rule 3 + rule 2: after re-redirect, user accepts realistic expectations
    it("should return accepted result when user accepts realistic plan after re-redirect", async () => {
      lastGoal = "I have ₪18,000 and I want to double it in 6 months";
      const responder = createTrackedResponder([
        "ok fine, maybe in 2 years then",
        "ok I understand, let's do it long term",
      ]);
      lastTranscript = responder.transcript;

      const result = await handleUnrealisticExpectations(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(true);
    });

    // clarify.unrealistic.rules.md rule 5: clarifying question → agent answers briefly and re-asks → user accepts.
    it("should handle a clarifying question and accept after re-ask", async () => {
      lastGoal = "I have ₪18,000 and I want to double it in 6 months";
      const responder = createTrackedResponder([
        "what does a realistic plan look like?",
        "ok, that makes sense, let's do long term",
      ]);
      lastTranscript = responder.transcript;

      const result = await handleUnrealisticExpectations(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(true);
    });
  });

  // clarify.unrealistic.rules.md rule 4: rejected — extraction returns { accepted: false }.
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

    // clarify.unrealistic.rules.md rule 3 + rule 4: after re-redirect, user still insists on unrealistic goal
    it("should return rejected result when user still insists after re-redirect", async () => {
      lastGoal = "I have ₪18,000 and I want to double it in 6 months";
      const responder = createTrackedResponder([
        "ok fine, maybe in 2 years then",
        "No, I really think 2 years is enough, I've seen it done",
      ]);
      lastTranscript = responder.transcript;

      const result = await handleUnrealisticExpectations(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(false);
    });

    // clarify.unrealistic.rules.md rule 3 + rule 4: after re-redirect, user disengages
    it("should return rejected result when user disengages after re-redirect", async () => {
      lastGoal = "I have ₪18,000 and I want to double it in 6 months";
      const responder = createTrackedResponder([
        "ok fine, maybe in 2 years then",
        "forget it, this isn't what I was looking for",
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
