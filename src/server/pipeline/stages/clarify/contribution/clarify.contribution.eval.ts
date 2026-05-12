import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import type { AllocationPhaseOutput } from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import { collectContribution } from "#pipeline/stages/clarify/contribution/clarify.contribution";
import type { ContributionPhaseResult } from "#pipeline/stages/clarify/contribution/clarify.contribution.types";
import type { ParametersPhaseOutput } from "#pipeline/stages/clarify/parameters/clarify.parameters.types";
import { TimelineBucketEnum } from "#schemas/pipeline.schemas";

const LAST_RUN_PATH = new URL("clarify.contribution.last-run.md", import.meta.url)
  .pathname;

describe("collectContribution", () => {
  const mockParameters: ParametersPhaseOutput = {
    amount: 30_000,
    timeline: TimelineBucketEnum.enum["10+ years"],
  };

  const mockAllocation: AllocationPhaseOutput = {
    equityPercentage: 70,
    bufferPercentage: 30,
  };

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

  // clarify.contribution.rules.md rule 1: Israel-specific concern → address accurately → yes
  it("should address fractional share concern and return true after user confirms", async () => {
    const responder = createTrackedResponder([
      "In Israel you can't buy partial ETF units so it's hard to invest small amounts",
      "Ok, investing quarterly makes sense to me — yes I'd like to do that",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(mockParameters, mockAllocation, responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.plansToContribute).toBe(true);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
    // Israel-specific response must reference actual equity amount (₪21,000)
    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns.some((t) => /21[,.]?000|₪21/.test(t.content))).toBe(true);
  });

  // clarify.contribution.rules.md rule 1: Israel-specific concern → address accurately → no
  it("should address fractional share concern and return false after user declines", async () => {
    const responder = createTrackedResponder([
      "In Israel you can't buy partial ETF units so it seems impractical",
      "I see, but I think I'll just invest a lump sum once",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(mockParameters, mockAllocation, responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.plansToContribute).toBe(false);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });

  // clarify.contribution.rules.md rule 2: user asks what DCA means → explanation → yes
  it("should explain DCA when asked and return true after user confirms", async () => {
    const responder = createTrackedResponder([
      "What does contributing periodically mean?",
      "Oh that makes sense, yes I'd like to do that",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(mockParameters, mockAllocation, responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.plansToContribute).toBe(true);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
    // explanation turn must reference actual equity amount (₪30,000 × 70% = ₪21,000)
    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns[1].content).toMatch(/21[,.]?000|₪21/);
  });

  // clarify.contribution.rules.md rule 2: user asks what DCA means → explanation → no
  it("should explain DCA when asked and return false after user declines", async () => {
    const responder = createTrackedResponder([
      "What's DCA?",
      "I see, but no — I'll just do a one-time investment",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(mockParameters, mockAllocation, responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.plansToContribute).toBe(false);
  });

  // clarify.contribution.rules.md rule 3: explicit yes → plansToContribute: true
  it("should return true when user explicitly confirms periodic contributions", async () => {
    const responder = createTrackedResponder(["Yes, I plan to add ₪500 every month"]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(mockParameters, mockAllocation, responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.plansToContribute).toBe(true);
  });

  // clarify.contribution.rules.md rule 4: explicit no → plansToContribute: false
  it("should return false when user explicitly declines periodic contributions", async () => {
    const responder = createTrackedResponder(["No, this is a one-time investment"]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(mockParameters, mockAllocation, responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.plansToContribute).toBe(false);
  });
});
