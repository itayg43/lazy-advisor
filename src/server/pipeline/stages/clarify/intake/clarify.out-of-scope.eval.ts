import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { handleOutOfScopeRedirect } from "#pipeline/stages/clarify/intake/clarify.out-of-scope";

const LAST_RUN_PATH = new URL("clarify.out-of-scope.last-run.md", import.meta.url)
  .pathname;

describe("handleOutOfScopeRedirect", () => {
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

  // clarify.stage.rules.md rule 1: redirect explains concentration risk, offers sector ETF middle ground,
  // and ends with a question. Field collection begins only after acceptance — not in this phase.
  describe("accepted", () => {
    it("should redirect and return accepted result with responseId", async () => {
      lastGoal = "Should I buy NVIDIA stock?";
      const responder = createTrackedResponder(["ok fine, I'm open to ETFs"]);
      lastTranscript = responder.transcript;

      const result = await handleOutOfScopeRedirect(
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
    it("should return rejected result when user insists on stock picking", async () => {
      lastGoal = "Should I buy NVIDIA stock?";
      const responder = createTrackedResponder([
        "No, I only want to buy NVIDIA, not interested in ETFs",
      ]);
      lastTranscript = responder.transcript;

      const result = await handleOutOfScopeRedirect(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(false);
    });
  });
});
