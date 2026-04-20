import { describe, expect, it } from "vitest";

import { classifyGoal } from "#pipeline/stages/clarify/intake/clarify.classify";
import { GoalClassification } from "#pipeline/stages/clarify/shared/clarify.schemas";

describe("classifyGoal", () => {
  // clarify.stage.rules.md rule 1: individual stock picking, day trading, and direct crypto purchases
  // are out of scope — redirect to ETF-based investing.
  describe(GoalClassification.enum.out_of_scope, () => {
    it("should classify individual stock picking as out_of_scope", async () => {
      const result = await classifyGoal("Should I buy NVIDIA stock?");
      expect(result).toBe(GoalClassification.enum.out_of_scope);
    });

    it("should classify day trading as out_of_scope", async () => {
      const result = await classifyGoal("I want to do day trading with ₪20,000");
      expect(result).toBe(GoalClassification.enum.out_of_scope);
    });

    it("should classify direct crypto purchase as out_of_scope", async () => {
      const result = await classifyGoal("I want to buy Bitcoin with ₪15,000");
      expect(result).toBe(GoalClassification.enum.out_of_scope);
    });
  });

  // clarify.stage.rules.md rule 2: unrealistic return expectations are redirected before field collection.
  describe(GoalClassification.enum.unrealistic, () => {
    it("should classify doubling capital in 6 months as unrealistic", async () => {
      const result = await classifyGoal(
        "I have ₪18,000 and I want to double it in 6 months",
      );
      expect(result).toBe(GoalClassification.enum.unrealistic);
    });
  });

  // clarify.stage.rules.md rule 4: contradictory risk signals in the goal are resolved before field collection.
  describe(GoalClassification.enum.contradictory, () => {
    it("should classify conflicting risk signals as contradictory", async () => {
      const result = await classifyGoal(
        "I want maximum returns but I can't afford to lose any money",
      );
      expect(result).toBe(GoalClassification.enum.contradictory);
    });
  });

  // Normal goals pass through to field collection without an intake phase.
  describe(GoalClassification.enum.normal, () => {
    it("should classify a vague goal as normal", async () => {
      const result = await classifyGoal("I want to start investing");
      expect(result).toBe(GoalClassification.enum.normal);
    });

    it("should classify a crypto ETF goal as normal", async () => {
      // CLARIFY_RULES deferred: crypto ETFs (e.g. IBIT) are valid aggressive preferences,
      // not out of scope — only direct crypto purchases are redirected.
      const result = await classifyGoal("I want to invest in a Bitcoin ETF like IBIT");
      expect(result).toBe(GoalClassification.enum.normal);
    });

    it("should classify a rich goal as normal", async () => {
      const result = await classifyGoal(
        "I'm 35, I have ₪75,000, moderate risk, long-term retirement savings",
      );
      expect(result).toBe(GoalClassification.enum.normal);
    });
  });
});
