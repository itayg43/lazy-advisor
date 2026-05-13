import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { collectContribution } from "#pipeline/stages/clarify/contribution/clarify.contribution";
import type { ContributionPhaseResult } from "#pipeline/stages/clarify/contribution/clarify.contribution.types";

const LAST_RUN_PATH = new URL("clarify.contribution.last-run.md", import.meta.url)
  .pathname;

describe("collectContribution", () => {
  const mockAmount = 30_000;
  const mockEquityPercentage = 70;

  let lastTranscript: TranscriptEntry[] | undefined;
  let lastOutput: ContributionPhaseResult | undefined;

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

  // clarify.contribution.rules.md rule 1: Israel-specific concern → address accurately → yes/no
  it.each([
    {
      initial:
        "In Israel you can't buy partial ETF units so it's hard to invest small amounts",
      final: "Ok, investing quarterly makes sense to me — yes I'd like to do that",
      expectedPlans: true,
    },
    {
      initial: "In Israel you can't buy partial ETF units so it seems impractical",
      final: "I see, but I think I'll just invest a lump sum once",
      expectedPlans: false,
    },
  ])(
    "should address fractional share concern then return $expectedPlans",
    async ({ initial, final, expectedPlans }) => {
      const responder = createTrackedResponder([initial, final]);
      lastTranscript = responder.transcript;

      const output = await collectContribution(
        mockAmount,
        mockEquityPercentage,
        responder,
      );
      lastOutput = output;
      if (output.status !== "completed") return;

      expect(output.plansToContribute).toBe(expectedPlans);
      const agentTurns = responder.transcript.filter((t) => t.role === "agent");
      expect(agentTurns).toHaveLength(2);
      // clarification turn must reference actual equity amount (₪30,000 × 70% = ₪21,000)
      expect(agentTurns[1].content).toMatch(/21[,.]?000|₪21/);
    },
  );

  // clarify.contribution.rules.md rule 2: user asks what DCA means → explanation → yes/no
  it.each([
    {
      initial: "What does contributing periodically mean?",
      final: "Oh that makes sense, yes I'd like to do that",
      expectedPlans: true,
    },
    {
      initial: "What's DCA?",
      final: "I see, but no — I'll just do a one-time investment",
      expectedPlans: false,
    },
  ])(
    "should explain DCA when asked then return $expectedPlans",
    async ({ initial, final, expectedPlans }) => {
      const responder = createTrackedResponder([initial, final]);
      lastTranscript = responder.transcript;

      const output = await collectContribution(
        mockAmount,
        mockEquityPercentage,
        responder,
      );
      lastOutput = output;
      if (output.status !== "completed") return;

      expect(output.plansToContribute).toBe(expectedPlans);
      const agentTurns = responder.transcript.filter((t) => t.role === "agent");
      expect(agentTurns).toHaveLength(2);
      // explanation turn must reference actual equity amount (₪30,000 × 70% = ₪21,000)
      expect(agentTurns[1].content).toMatch(/21[,.]?000|₪21/);
    },
  );

  // clarify.contribution.rules.md rule 3: explicit yes → plansToContribute: true
  it("should return true when user explicitly confirms periodic contributions", async () => {
    const responder = createTrackedResponder(["Yes, I plan to add ₪500 every month"]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(mockAmount, mockEquityPercentage, responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.plansToContribute).toBe(true);
  });

  // clarify.contribution.rules.md rule 4: explicit no → plansToContribute: false
  it("should return false when user explicitly declines periodic contributions", async () => {
    const responder = createTrackedResponder(["No, this is a one-time investment"]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(mockAmount, mockEquityPercentage, responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.plansToContribute).toBe(false);
  });
});
