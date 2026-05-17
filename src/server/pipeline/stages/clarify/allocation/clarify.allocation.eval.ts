import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { collectAllocation } from "#pipeline/stages/clarify/allocation/clarify.allocation";
import type {
  AllocationPhaseInput,
  AllocationPhaseOutput,
  AllocationPhaseResult,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import { RiskToleranceEnum, TimelineBucketEnum } from "#schemas/pipeline.schemas";

const LAST_RUN_PATH = new URL("clarify.allocation.last-run.md", import.meta.url).pathname;

const { conservative, moderate, aggressive } = RiskToleranceEnum.enum;

describe("collectAllocation", () => {
  // Default scores hit the deep end of each bucket; within-bucket discrimination
  // cases below override the score to verify the LLM honors the precomputed value.
  const longHorizonAggressiveInput: AllocationPhaseInput = {
    amount: 50_000,
    timeline: TimelineBucketEnum.enum["10+ years"],
    riskTolerance: aggressive,
    riskSelfRatingScore: 5,
  };

  const midHorizonModerateInput: AllocationPhaseInput = {
    amount: 80_000,
    timeline: TimelineBucketEnum.enum["5–10 years"],
    riskTolerance: moderate,
    riskSelfRatingScore: 3,
  };

  const longHorizonConservativeInput: AllocationPhaseInput = {
    amount: 60_000,
    timeline: TimelineBucketEnum.enum["10+ years"],
    riskTolerance: conservative,
    riskSelfRatingScore: 2,
  };

  const shortMidHorizonConservativeInput: AllocationPhaseInput = {
    amount: 30_000,
    timeline: TimelineBucketEnum.enum["3–5 years"],
    riskTolerance: conservative,
    riskSelfRatingScore: 2,
  };

  // Asserts the agent's transcript mentions shekel amounts consistent with the final
  // extracted split — catches model arithmetic drift (e.g., "₪85,000 equity + ₪15,000
  // buffer" on a ₪50,000 investment). Looks for the expected shekels anywhere in the
  // combined agent text, since counter-proposal / sanity-check turns may supersede the
  // initial proposal's numbers. Skips the zero side at 0%/100% boundaries: models phrase
  // an empty bucket as "0% equity" rather than "₪0", and arithmetic drift can't occur
  // there anyway.
  const expectShekelMathConsistent = (
    transcript: TranscriptEntry[],
    amount: number,
    output: AllocationPhaseOutput,
  ) => {
    const expectedEquityShekels = (amount * output.equityPercentage) / 100;
    const expectedBufferShekels = amount - expectedEquityShekels;
    const agentText = transcript
      .filter((t) => t.role === "agent")
      .map((t) => t.content)
      .join(" ");
    if (output.equityPercentage > 0) {
      expect(agentText).toContain(`₪${expectedEquityShekels.toLocaleString("en-US")}`);
    }
    if (output.bufferPercentage > 0) {
      expect(agentText).toContain(`₪${expectedBufferShekels.toLocaleString("en-US")}`);
    }
  };

  // Narrows an AllocationPhaseResult to its success branch so the rest of the
  // test can assert on the equity/buffer fields directly.
  const expectSuccess = (result: AllocationPhaseResult): AllocationPhaseOutput => {
    expect(result.status).toBe("completed");
    if (result.status !== "completed") {
      throw new Error("expected allocation completed result");
    }

    return result;
  };

  let lastTranscript: TranscriptEntry[] | undefined;
  let lastOutput: AllocationPhaseResult | undefined;

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

  // clarify.allocation.rules.md rule 1 + 2: anchor proposal accepted as-is (happy path)
  it("should propose the cell-appropriate anchor and end on user acceptance", async () => {
    const responder = createTrackedResponder(["Sounds good"]);
    lastTranscript = responder.transcript;

    const result = await collectAllocation(longHorizonAggressiveInput, responder);
    lastOutput = result;
    const output = expectSuccess(result);

    // aggressive + 10+ yr cell = 80–90%
    expect(output.equityPercentage).toBeGreaterThanOrEqual(80);
    expect(output.equityPercentage).toBeLessThanOrEqual(90);
    expect(output.equityPercentage + output.bufferPercentage).toBe(100);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(1);
    expectShekelMathConsistent(
      responder.transcript,
      longHorizonAggressiveInput.amount,
      output,
    );

    // behavioral framing must use "tends to reduce", never "prevents" or "eliminates"
    const agentText = responder.transcript
      .filter((t) => t.role === "agent")
      .map((t) => t.content.toLowerCase())
      .join(" ");
    expect(agentText).toContain("tends to reduce");
    expect(agentText).not.toContain("prevents");
    expect(agentText).not.toContain("eliminates");
  });

  // clarify.allocation.rules.md rule 1: moderate 5–10yr lands in the 50–60% cell
  it("should land in the 50–60% cell for moderate risk + 5–10 year timeline", async () => {
    const responder = createTrackedResponder(["ok"]);
    lastTranscript = responder.transcript;

    const result = await collectAllocation(midHorizonModerateInput, responder);
    lastOutput = result;
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBeGreaterThanOrEqual(50);
    expect(output.equityPercentage).toBeLessThanOrEqual(60);
    expect(output.equityPercentage + output.bufferPercentage).toBe(100);
    expectShekelMathConsistent(
      responder.transcript,
      midHorizonModerateInput.amount,
      output,
    );
  });

  // clarify.allocation.rules.md rule 1 (within-bucket discrimination):
  // verifies the LLM uses the precomputed proposal — score 4 (shallow end of
  // aggressive bucket) lands on min+2 = 82 for the 80–90 cell, not somewhere else.
  it("should propose 82% equity for aggressive 10+ year with riskSelfRatingScore=4", async () => {
    const responder = createTrackedResponder(["Sounds good"]);
    lastTranscript = responder.transcript;

    const input: AllocationPhaseInput = {
      ...longHorizonAggressiveInput,
      riskSelfRatingScore: 4,
    };
    const result = await collectAllocation(input, responder);
    lastOutput = result;
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(82);
    expect(output.bufferPercentage).toBe(18);
    expectShekelMathConsistent(responder.transcript, input.amount, output);
  });

  // clarify.allocation.rules.md rule 1 (within-bucket discrimination):
  // verifies the LLM uses the precomputed proposal — score 1 (deep end of
  // conservative bucket) lands on min+2 = 42 for the 40–50 cell.
  it("should propose 42% equity for conservative 10+ year with riskSelfRatingScore=1", async () => {
    const responder = createTrackedResponder(["Sounds good"]);
    lastTranscript = responder.transcript;

    const input: AllocationPhaseInput = {
      ...longHorizonConservativeInput,
      riskSelfRatingScore: 1,
    };
    const result = await collectAllocation(input, responder);
    lastOutput = result;
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(42);
    expect(output.bufferPercentage).toBe(58);
    expectShekelMathConsistent(responder.transcript, input.amount, output);
  });

  // clarify.allocation.rules.md rule 1: conservative 3–5yr lands in the 10–20% cell
  it("should land in the 10–20% cell for conservative risk + 3–5 year timeline", async () => {
    const responder = createTrackedResponder(["ok"]);
    lastTranscript = responder.transcript;

    const result = await collectAllocation(shortMidHorizonConservativeInput, responder);
    lastOutput = result;
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBeGreaterThanOrEqual(10);
    expect(output.equityPercentage).toBeLessThanOrEqual(20);
    expect(output.equityPercentage + output.bufferPercentage).toBe(100);
    expectShekelMathConsistent(
      responder.transcript,
      shortMidHorizonConservativeInput.amount,
      output,
    );
  });

  // clarify.allocation.rules.md rule 3: non-round counter-proposal honored without snapping
  it("should honor a non-round counter-proposal exactly (no snap-to-cell)", async () => {
    const responder = createTrackedResponder(["77%", "yes"]);
    lastTranscript = responder.transcript;

    const result = await collectAllocation(longHorizonAggressiveInput, responder);
    lastOutput = result;
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(77);
    expect(output.bufferPercentage).toBe(23);
    expectShekelMathConsistent(
      responder.transcript,
      longHorizonAggressiveInput.amount,
      output,
    );
  });

  // clarify.allocation.rules.md rule 3: mid-size counter-proposal still honored (not extreme for profile)
  it("should honor a mid-size counter-proposal outside the cell when not extreme", async () => {
    const responder = createTrackedResponder(["Let's do 50/50", "yes"]);
    lastTranscript = responder.transcript;

    const result = await collectAllocation(longHorizonAggressiveInput, responder);
    lastOutput = result;
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(50);
    expect(output.bufferPercentage).toBe(50);
    expectShekelMathConsistent(
      responder.transcript,
      longHorizonAggressiveInput.amount,
      output,
    );
  });

  // clarify.allocation.rules.md rule 3 exception: conservative user asks for 100% → sanity check fires, accept
  it("should surface a sanity check when a conservative user asks for 100% stocks", async () => {
    const responder = createTrackedResponder([
      "Actually I want 100% stocks",
      "Yes, I'm sure",
    ]);
    lastTranscript = responder.transcript;

    const result = await collectAllocation(longHorizonConservativeInput, responder);
    lastOutput = result;
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(100);
    expect(output.bufferPercentage).toBe(0);
    // sanity-check turn should happen — at least 2 agent messages (proposal + sanity check)
    expect(
      responder.transcript.filter((t) => t.role === "agent").length,
    ).toBeGreaterThanOrEqual(2);
    expectShekelMathConsistent(
      responder.transcript,
      longHorizonConservativeInput.amount,
      output,
    );
  });

  // clarify.allocation.rules.md rule 3 exception: aggressive 10+ yr user asks for 0% equity → sanity check fires, accept
  it("should surface a sanity check when a long-horizon aggressive user asks for 0% equity", async () => {
    const responder = createTrackedResponder(["I want 0% stocks", "Yes, I'm sure"]);
    lastTranscript = responder.transcript;

    const result = await collectAllocation(longHorizonAggressiveInput, responder);
    lastOutput = result;
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(0);
    expect(output.bufferPercentage).toBe(100);
    expect(
      responder.transcript.filter((t) => t.role === "agent").length,
    ).toBeGreaterThanOrEqual(2);
    expectShekelMathConsistent(
      responder.transcript,
      longHorizonAggressiveInput.amount,
      output,
    );
  });

  // clarify.allocation.rules.md rule 4: clarifying question answered + re-ask, then accept
  it("should answer a clarifying question then return to the anchor proposal", async () => {
    const responder = createTrackedResponder(["What's a buffer?", "Got it, sounds good"]);
    lastTranscript = responder.transcript;

    const result = await collectAllocation(longHorizonAggressiveInput, responder);
    lastOutput = result;
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBeGreaterThanOrEqual(80);
    expect(output.equityPercentage).toBeLessThanOrEqual(90);
    expect(output.equityPercentage + output.bufferPercentage).toBe(100);
    expect(
      responder.transcript.filter((t) => t.role === "agent").length,
    ).toBeGreaterThanOrEqual(2);
    expectShekelMathConsistent(
      responder.transcript,
      longHorizonAggressiveInput.amount,
      output,
    );
  });

  // clarify.allocation.rules.md rule 4: method question answered without exposing internal labels
  it("should answer a method question and re-ask the anchor", async () => {
    const responder = createTrackedResponder([
      "How did you come up with that split?",
      "Got it, sounds good",
    ]);
    lastTranscript = responder.transcript;

    const result = await collectAllocation(longHorizonAggressiveInput, responder);
    lastOutput = result;
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBeGreaterThanOrEqual(80);
    expect(output.equityPercentage).toBeLessThanOrEqual(90);
    expect(output.equityPercentage + output.bufferPercentage).toBe(100);
    expect(
      responder.transcript.filter((t) => t.role === "agent").length,
    ).toBeGreaterThanOrEqual(2);

    // internal risk labels must never leak to the user
    const agentText = responder.transcript
      .filter((t) => t.role === "agent")
      .map((t) => t.content.toLowerCase())
      .join(" ");
    expect(agentText).not.toContain("aggressive");
    expect(agentText).not.toContain("conservative");
    expect(agentText).not.toContain("moderate");
    expectShekelMathConsistent(
      responder.transcript,
      longHorizonAggressiveInput.amount,
      output,
    );
  });

  // clarify.allocation.rules.md rule 4: instrument question deflected to later phases
  it("should deflect an instrument question to later phases and re-ask the anchor", async () => {
    const responder = createTrackedResponder(["Which ETF should I buy?", "Sounds good"]);
    lastTranscript = responder.transcript;

    const result = await collectAllocation(longHorizonAggressiveInput, responder);
    lastOutput = result;
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBeGreaterThanOrEqual(80);
    expect(output.equityPercentage).toBeLessThanOrEqual(90);
    expect(output.equityPercentage + output.bufferPercentage).toBe(100);
    expect(
      responder.transcript.filter((t) => t.role === "agent").length,
    ).toBeGreaterThanOrEqual(2);
    expectShekelMathConsistent(
      responder.transcript,
      longHorizonAggressiveInput.amount,
      output,
    );
  });

  // clarify.allocation.rules.md rule 4 + rule 3: clarifying question followed by counter-proposal (4-tool-call worst case)
  it("should handle a clarifying question followed by a counter-proposal", async () => {
    const responder = createTrackedResponder([
      "What's a buffer?",
      "Let's do 60/40",
      "yes",
    ]);
    lastTranscript = responder.transcript;

    const result = await collectAllocation(longHorizonAggressiveInput, responder);
    lastOutput = result;
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(60);
    expect(output.bufferPercentage).toBe(40);
    // clarifying Q answer + re-ask + counter-proposal confirm = at least 3 agent turns
    expect(
      responder.transcript.filter((t) => t.role === "agent").length,
    ).toBeGreaterThanOrEqual(3);
    expectShekelMathConsistent(
      responder.transcript,
      longHorizonAggressiveInput.amount,
      output,
    );
  });

  // T3.9: PhaseBudgetExhaustedError → { status: "failure", reason: "split_unresolved" }.
  // A chain of counter-proposals forces one confirmation tool call each; once toolCallCount
  // exceeds MAX_ALLOCATION_TOOL_CALLS (5) the phase loop throws and collectAllocation
  // returns the failure variant.
  it("should return failure when the user keeps counter-proposing past the tool-call budget", async () => {
    const responder = createTrackedResponder([
      "Actually I want 60% stocks",
      "Wait, let's do 55%",
      "Sorry, change to 50%",
      "Actually 45%",
      "Make it 40%",
      "Hmm, 35%",
      "OK 30%",
    ]);
    lastTranscript = responder.transcript;

    const result = await collectAllocation(longHorizonAggressiveInput, responder);
    lastOutput = result;

    expect(result.status).toBe("unresolved");
    if (result.status !== "unresolved") return;
    expect(result.reason).toBe("allocation");
  });
});
