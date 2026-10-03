import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { appendLastRunEntry, initLastRun } from "#pipeline/eval.last-run";
import { classifyGoal } from "#pipeline/stages/clarify/intake/classify/clarify.classify";
import { GoalClassificationEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";

const LAST_RUN_PATH = new URL("clarify.classify.last-run.md", import.meta.url).pathname;

describe("classifyGoal", () => {
  let lastGoal: string | undefined;
  let lastClassification: string | undefined;

  beforeAll(() => initLastRun(LAST_RUN_PATH));

  afterEach((ctx) => {
    if (lastGoal === undefined) return;
    appendLastRunEntry(LAST_RUN_PATH, {
      name: ctx.task.name,
      passed: ctx.task.result?.state === "pass",
      goal: lastGoal,
      transcript: [],
      output:
        lastClassification !== undefined
          ? { classification: lastClassification }
          : undefined,
      error: ctx.task.result?.errors?.[0]?.message,
    });
    lastGoal = lastClassification = undefined;
  });

  // clarify.classify.rules.md rule 1: individual stock picking, day trading, direct crypto purchases,
  // and mixed ETF+stock goals are out of scope — redirect to ETF-based investing.
  describe(GoalClassificationEnum.enum.out_of_scope, () => {
    it("should classify individual stock picking as out_of_scope", async () => {
      lastGoal = "Should I buy NVIDIA stock?";
      const result = await classifyGoal(lastGoal);
      lastClassification = result;
      expect(result).toBe(GoalClassificationEnum.enum.out_of_scope);
    });

    it("should classify day trading as out_of_scope", async () => {
      lastGoal = "I want to do day trading with ₪20,000";
      const result = await classifyGoal(lastGoal);
      lastClassification = result;
      expect(result).toBe(GoalClassificationEnum.enum.out_of_scope);
    });

    it("should classify direct crypto purchase as out_of_scope", async () => {
      lastGoal = "I want to buy Bitcoin with ₪15,000";
      const result = await classifyGoal(lastGoal);
      lastClassification = result;
      expect(result).toBe(GoalClassificationEnum.enum.out_of_scope);
    });

    it("should classify a mixed ETF-and-stock goal as out_of_scope", async () => {
      // ETF interest doesn't neutralize the stock-picking component — still needs redirect.
      lastGoal = "I want to invest in ETFs but also buy some NVIDIA stock";
      const result = await classifyGoal(lastGoal);
      lastClassification = result;
      expect(result).toBe(GoalClassificationEnum.enum.out_of_scope);
    });
  });

  // clarify.classify.rules.md rule 2: unrealistic return expectations are redirected before field collection.
  describe(GoalClassificationEnum.enum.unrealistic, () => {
    it("should classify doubling capital in 6 months as unrealistic", async () => {
      lastGoal = "I have ₪18,000 and I want to double it in 6 months";
      const result = await classifyGoal(lastGoal);
      lastClassification = result;
      expect(result).toBe(GoalClassificationEnum.enum.unrealistic);
    });
  });

  // clarify.classify.rules.md rule 3: contradictory risk signals in the goal are resolved before field collection.
  describe(GoalClassificationEnum.enum.contradictory, () => {
    it("should classify conflicting risk signals as contradictory", async () => {
      lastGoal = "I want maximum returns but I can't afford to lose any money";
      const result = await classifyGoal(lastGoal);
      lastClassification = result;
      expect(result).toBe(GoalClassificationEnum.enum.contradictory);
    });
  });

  // clarify.classify.rules.md rule 4: everything else passes as normal — vague goals, crypto ETFs, rich goals.
  // When in doubt, classify as normal.
  describe(GoalClassificationEnum.enum.normal, () => {
    it("should classify a vague goal as normal", async () => {
      lastGoal = "I want to start investing";
      const result = await classifyGoal(lastGoal);
      lastClassification = result;
      expect(result).toBe(GoalClassificationEnum.enum.normal);
    });

    it("should classify a crypto ETF goal as normal", async () => {
      // CLARIFY_RULES deferred: crypto ETFs (e.g. IBIT) are valid aggressive preferences,
      // not out of scope — only direct crypto purchases are redirected.
      lastGoal = "I want to invest in a Bitcoin ETF like IBIT";
      const result = await classifyGoal(lastGoal);
      lastClassification = result;
      expect(result).toBe(GoalClassificationEnum.enum.normal);
    });

    it("should classify a rich goal as normal", async () => {
      lastGoal = "I'm 35, I have ₪75,000, moderate risk, long-term retirement savings";
      const result = await classifyGoal(lastGoal);
      lastClassification = result;
      expect(result).toBe(GoalClassificationEnum.enum.normal);
    });

    it("should classify a sector-only ETF goal as normal", async () => {
      // Sector preference is still ETF-based investing — normal by rule 4.
      lastGoal = "I want to invest in real estate ETFs";
      const result = await classifyGoal(lastGoal);
      lastClassification = result;
      expect(result).toBe(GoalClassificationEnum.enum.normal);
    });
  });
});
