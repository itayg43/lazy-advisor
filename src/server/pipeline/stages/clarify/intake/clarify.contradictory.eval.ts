import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { handleContradictoryRisk } from "#pipeline/stages/clarify/intake/clarify.contradictory";

const LAST_RUN_PATH = new URL("CLARIFY_CONTRADICTORY_LAST_RUN.md", import.meta.url)
  .pathname;

describe("handleContradictoryRisk", () => {
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

  // CLARIFY_RULES #3: stage uses a concrete loss scenario to resolve contradictory risk signals.
  describe("accepted", () => {
    it("should resolve contradiction and return accepted result when user picks a risk level", async () => {
      lastGoal = "I want maximum returns but I can't afford to lose any money";
      const responder = createTrackedResponder([
        "If my portfolio dropped 20% I'd feel sick but I'd hold and wait for recovery. I guess I'm moderate.",
      ]);
      lastTranscript = responder.transcript;

      const result = await handleContradictoryRisk(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.responseId).toBeTruthy();
      }
    });
  });

  describe("rejected", () => {
    it("should return rejected result when user disengages without resolving", async () => {
      lastGoal = "I want maximum returns but I can't afford to lose any money";
      const responder = createTrackedResponder([
        "I don't know, forget it, I'm not interested anymore",
      ]);
      lastTranscript = responder.transcript;

      const result = await handleContradictoryRisk(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(false);
    });
  });
});
