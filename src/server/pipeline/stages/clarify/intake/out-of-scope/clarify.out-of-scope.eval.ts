import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { handleOutOfScopeRedirect } from "#pipeline/stages/clarify/intake/out-of-scope/clarify.out-of-scope";

const LAST_RUN_PATH = new URL("clarify.out-of-scope.last-run.md", import.meta.url)
  .pathname;

describe("handleOutOfScopeRedirect", () => {
  // Regression guard for issue #7: redirect must not name specific ETFs/tickers — fund selection happens in later phases.
  const TICKER_PATTERN =
    /\b(NASDAQ-100|NASDAQ100|QQQ|SOXX|SMH|IBIT|SPY|VOO|VTI|XLK|XLF)\b/i;

  const expectNoTickersInAgentMessages = (transcript: TranscriptEntry[]) => {
    for (const turn of transcript) {
      if (turn.role !== "agent") continue;
      expect(turn.content).not.toMatch(TICKER_PATTERN);
    }
  };

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

  // clarify.out-of-scope.rules.md rule 1: redirect explains concentration risk, offers a diversified ETF (no ticker),
  // and ends with a question. Field collection begins only after acceptance — not in this phase.
  // clarify.out-of-scope.rules.md rule 2: accepted — extraction returns { accepted: true }.
  describe("accepted", () => {
    it("should redirect and return accepted result", async () => {
      lastGoal = "Should I buy NVIDIA stock?";
      const responder = createTrackedResponder(["ok fine, I'm open to ETFs"]);
      lastTranscript = responder.transcript;

      const result = await handleOutOfScopeRedirect(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(true);
      expectNoTickersInAgentMessages(responder.transcript);
    });

    it("should redirect day trading and return accepted result", async () => {
      lastGoal = "I want to do day trading with ₪20,000";
      const responder = createTrackedResponder(["ok, I'll try an index ETF instead"]);
      lastTranscript = responder.transcript;

      const result = await handleOutOfScopeRedirect(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(true);
      expectNoTickersInAgentMessages(responder.transcript);
    });

    it("should redirect direct crypto and return accepted result", async () => {
      lastGoal = "I want to buy Bitcoin with ₪15,000";
      const responder = createTrackedResponder(["ok, a crypto ETF sounds good"]);
      lastTranscript = responder.transcript;

      const result = await handleOutOfScopeRedirect(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(true);
      expectNoTickersInAgentMessages(responder.transcript);
    });

    // clarify.out-of-scope.rules.md rule 2: hesitant/reluctant agreement still counts as accepted.
    it("should accept reluctant agreement", async () => {
      lastGoal = "Should I buy NVIDIA stock?";
      const responder = createTrackedResponder(["I guess I'll try ETFs"]);
      lastTranscript = responder.transcript;

      const result = await handleOutOfScopeRedirect(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(true);
      expectNoTickersInAgentMessages(responder.transcript);
    });

    // clarify.out-of-scope.rules.md rule 4: clarifying question → agent answers briefly and re-asks → user accepts.
    it("should handle a clarifying question and accept after re-ask", async () => {
      lastGoal = "Should I buy NVIDIA stock?";
      const responder = createTrackedResponder(["what's an ETF?", "ok, sounds good"]);
      lastTranscript = responder.transcript;

      const result = await handleOutOfScopeRedirect(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(true);
      expectNoTickersInAgentMessages(responder.transcript);
    });
  });

  // clarify.out-of-scope.rules.md rule 3: rejected — extraction returns { accepted: false }.
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
      expectNoTickersInAgentMessages(responder.transcript);
    });

    it("should return rejected result when day-trading user insists", async () => {
      lastGoal = "I want to do day trading with ₪20,000";
      const responder = createTrackedResponder([
        "No, I only want to day trade, not interested in ETFs",
      ]);
      lastTranscript = responder.transcript;

      const result = await handleOutOfScopeRedirect(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(false);
      expectNoTickersInAgentMessages(responder.transcript);
    });

    it("should return rejected result when crypto user insists", async () => {
      lastGoal = "I want to buy Bitcoin with ₪15,000";
      const responder = createTrackedResponder(["No, I only want Bitcoin directly"]);
      lastTranscript = responder.transcript;

      const result = await handleOutOfScopeRedirect(
        lastGoal,
        responder.sendToUser,
        responder.waitForResponse,
      );

      expect(result.accepted).toBe(false);
      expectNoTickersInAgentMessages(responder.transcript);
    });
  });
});
