import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { handleContradictoryRisk } from "#pipeline/stages/clarify/intake/contradictory/clarify.contradictory";

const LAST_RUN_PATH = new URL("clarify.contradictory.last-run.md", import.meta.url)
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

  // clarify.contradictory.rules.md rule 1: stage presents a concrete loss scenario (A/B/C options)
  // to surface real risk preference. No field collection in this phase.
  // clarify.contradictory.rules.md rule 2: accepted — extraction returns { accepted: true }.
  describe("accepted", () => {
    it("should resolve contradiction and return accepted result when user picks a risk level", async () => {
      lastGoal = "I want maximum returns but I can't afford to lose any money";
      const responder = createTrackedResponder([
        "If my portfolio dropped 20% I'd feel sick but I'd hold and wait for recovery.",
      ]);
      lastTranscript = responder.transcript;

      const result = await handleContradictoryRisk(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(true);
    });
  });

  // clarify.contradictory.rules.md rule 3: rejected — extraction returns { accepted: false }.
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
