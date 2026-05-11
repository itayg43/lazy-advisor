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

      const result = await handleContradictoryRisk(lastGoal, responder);

      expect(result.accepted).toBe(true);
    });

    // clarify.contradictory.rules.md rule 2: hedging ("I'd probably hold but I'm not sure") still reveals a preference and counts as accepted
    it("should resolve contradiction and return accepted result when user hedges but reveals a preference", async () => {
      lastGoal = "I want maximum returns but I can't afford to lose any money";
      const responder = createTrackedResponder([
        "I'd probably hold but honestly I'm not sure.",
      ]);
      lastTranscript = responder.transcript;

      const result = await handleContradictoryRisk(lastGoal, responder);

      expect(result.accepted).toBe(true);
    });

    // clarify.contradictory.rules.md rule 4: clarifying question → agent answers briefly and re-presents the scenario → user picks an option.
    it("should handle a clarifying question and accept after re-ask", async () => {
      lastGoal = "I want maximum returns but I can't afford to lose any money";
      const responder = createTrackedResponder([
        "why does this matter?",
        "ok, I'd hold and wait for recovery.",
      ]);
      lastTranscript = responder.transcript;

      const result = await handleContradictoryRisk(lastGoal, responder);

      expect(result.accepted).toBe(true);
    });
  });

  // clarify.contradictory.rules.md rule 1: shekel figures adapted to amount mentioned in goal
  it("should use the goal amount in the scenario, not the generic ₪10,000 example", async () => {
    lastGoal =
      "I want maximum returns on my ₪50,000 but I can't afford to lose any money";
    const responder = createTrackedResponder(["I'd hold and wait for recovery."]);
    lastTranscript = responder.transcript;

    await handleContradictoryRisk(lastGoal, responder);

    const agentText = responder.transcript
      .filter((t) => t.role === "agent")
      .map((t) => t.content)
      .join(" ");
    // 20% drop of ₪50,000 → ₪40,000
    expect(agentText).toContain("₪50,000");
    expect(agentText).toContain("₪40,000");
    expect(agentText).not.toContain("₪10,000");
    expect(agentText).not.toContain("₪8,000");
  });

  // clarify.contradictory.rules.md rule 3: rejected — extraction returns { accepted: false }.
  describe("rejected", () => {
    it("should return rejected result when user disengages without resolving", async () => {
      lastGoal = "I want maximum returns but I can't afford to lose any money";
      const responder = createTrackedResponder([
        "I don't know, forget it, I'm not interested anymore",
      ]);
      lastTranscript = responder.transcript;

      const result = await handleContradictoryRisk(lastGoal, responder);

      expect(result.accepted).toBe(false);
    });
  });
});
