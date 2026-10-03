import type { EasyInputMessage } from "openai/resources/responses/responses";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { InternalError } from "#errors";
import { appendLastRunEntry, initLastRun } from "#pipeline/eval.last-run";
import { createTrackedResponder, type TranscriptEntry } from "#pipeline/eval.transcript";
import { collectAllocation } from "#pipeline/stages/clarify/allocation/clarify.allocation";
import { classifyTurn } from "#pipeline/stages/clarify/allocation/clarify.allocation.io";
import {
  AllocationJudgeCriterionEnum,
  judgeAllocationConversation,
  type AllocationJudgeOutput,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.judge";
import { AllocationIntentKindEnum } from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type {
  AllocationPhaseInput,
  AllocationPhaseOutput,
  AllocationPhaseResult,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import type { RiskTolerance } from "#pipeline/stages/clarify/risk/clarify.risk.types";
import { TimelineBucketEnum } from "#schemas/pipeline.schemas";

const LAST_RUN_PATH = new URL("clarify.allocation.last-run.md", import.meta.url).pathname;

describe("collectAllocation", () => {
  // Mutable capture for the last-run artifact: each test stashes its transcript,
  // result, and judge verdict here; afterEach writes them and resets to undefined.
  let lastTranscript: TranscriptEntry[] | undefined;
  let lastResult: AllocationPhaseResult | undefined;
  let lastJudge: AllocationJudgeOutput | undefined;

  // Default scores hit the deep end of each anchor range; within-cell discrimination
  // cases below override the score to verify the LLM honors the precomputed value.
  const longHorizonAggressiveInput: AllocationPhaseInput = {
    amount: 50_000,
    timeline: TimelineBucketEnum.enum["10+ years"],
    riskTolerance: 5,
  };

  const midHorizonModerateInput: AllocationPhaseInput = {
    amount: 80_000,
    timeline: TimelineBucketEnum.enum["5–10 years"],
    riskTolerance: 3,
  };

  const longHorizonConservativeInput: AllocationPhaseInput = {
    amount: 60_000,
    timeline: TimelineBucketEnum.enum["10+ years"],
    riskTolerance: 2,
  };

  const shortMidHorizonConservativeInput: AllocationPhaseInput = {
    amount: 30_000,
    timeline: TimelineBucketEnum.enum["3–5 years"],
    riskTolerance: 2,
  };

  // A percentage (optionally a range like "30–50%") sitting within ~40 chars of a
  // loss/decline word. This is the concrete drawdown framing that the too-high
  // sanity check MUST use and the too-low sanity check must NOT (the latter uses
  // opportunity-cost framing instead) — the two sanity-check tests assert the same
  // pattern with opposite polarity, so it lives here once. Cell-range mentions like
  // "80–90% equity" stay clear of it because they aren't paired with a loss word.
  const DRAWDOWN_FRAMING_PATTERN =
    /\d+(?:\s*[-–]\s*\d+)?\s*%[^.]{0,40}(?:decline|drop|disappear|drawdown|fall|loss|lose|bear)/;

  // Loose guard that a counter confirmation referenced the user's long horizon
  // ("10+", "long-term/run/horizon"). The LLM phrases this many ways; we only fail
  // if the timeline isn't mentioned at all.
  const TIMELINE_REFERENCE_PATTERN = /10\+|long.?(term|run|horizon)/;

  // The agent-authored turns, in order. Most assertions target a specific agent
  // turn by index (the proposal is [0], the first reply is [1], …) or scan the
  // combined agent prose, so both accessors are reused throughout.
  const agentTurns = (transcript: TranscriptEntry[]) =>
    transcript.filter((t) => t.role === "agent");
  const agentText = (transcript: TranscriptEntry[]) =>
    agentTurns(transcript)
      .map((t) => t.content)
      .join(" ");

  // Asserts the extracted equity lands inside an anchor cell's range and that the
  // two buckets sum to 100. For the cell-placement cases where the exact point
  // inside the cell is the LLM's to choose; exact-value cases assert with toBe.
  const expectEquityInRange = (
    output: AllocationPhaseOutput,
    min: number,
    max: number,
  ) => {
    expect(output.equityPercentage).toBeGreaterThanOrEqual(min);
    expect(output.equityPercentage).toBeLessThanOrEqual(max);
    expect(output.equityPercentage + output.bufferPercentage).toBe(100);
  };

  const expectMinAgentTurns = (transcript: TranscriptEntry[], min: number) => {
    expect(agentTurns(transcript).length).toBeGreaterThanOrEqual(min);
  };

  // The "never pin a risk personality on the user" rule is graded by the judge's
  // `no-risk-labeling` criterion on the relevant composed turns (each case lists
  // it inline), not a substring grep — a token scan can't tell "you're an
  // aggressive investor" (a violation) from "a moderate amount in stocks" (fine).
  // See clarify.allocation.rules.md, Anchor Table preamble + rule 4.

  // Asserts the agent's transcript states the split consistent with the final
  // extracted output — both the equity *percentage* (the value the classifier
  // extracted) and the shekel amounts derived from it. The shekel check catches
  // model arithmetic drift (e.g., "₪85,000 equity + ₪15,000 buffer" on a ₪50,000
  // investment); the percent check closes the gap where the composer keeps the
  // shekels right but restates the split with the wrong percentage (the residual
  // ALLOCATION_AUDIT.md Finding 2 risk — the number is woven into model-authored
  // framing, not code-rendered). Looks for each anywhere in the combined agent text,
  // since counter-proposal / sanity-check turns may supersede the initial proposal's
  // numbers. Skips the zero side at 0%/100% boundaries for shekels: models phrase an
  // empty bucket as "0% equity" rather than "₪0", and arithmetic drift can't occur
  // there anyway — the percent check still runs at the boundaries.
  const expectSplitConsistent = (
    transcript: TranscriptEntry[],
    amount: number,
    output: AllocationPhaseOutput,
  ) => {
    const expectedEquityAmount = (amount * output.equityPercentage) / 100;
    const expectedBufferAmount = amount - expectedEquityAmount;
    const text = agentText(transcript);

    // The equity percentage must appear as a percent ("77%") or the leading half of
    // a ratio ("90/10", "50/50") — the forms the composers and the initial proposal
    // use. A boundary-anchored regex (not toContain) pins the value to a %-or-/
    // terminator so an incidental digit run inside a shekel amount or a drawdown
    // range ("30–50%") can't satisfy it.
    expect(text).toMatch(new RegExp(`\\b${output.equityPercentage}\\s*(?:%|/)`));

    if (output.equityPercentage > 0)
      expect(text).toContain(`₪${expectedEquityAmount.toLocaleString("en-US")}`);

    if (output.bufferPercentage > 0)
      expect(text).toContain(`₪${expectedBufferAmount.toLocaleString("en-US")}`);
  };

  // rule 3 (Option-A): the first counter confirmation (agent turn [1]) must
  // reference the user's timeline via compound-impact framing.
  const expectCounterTurnReferencesTimeline = (transcript: TranscriptEntry[]) => {
    const counterTurn = agentTurns(transcript)[1].content.toLowerCase();
    expect(counterTurn).toMatch(TIMELINE_REFERENCE_PATTERN);
  };

  // rule 3 Branch 1: the sanity-check turn either uses concrete drawdown framing
  // (too-high direction) or deliberately avoids it (too-low, opportunity-cost).
  const expectDrawdownFraming = (turn: string) => {
    expect(turn).toMatch(DRAWDOWN_FRAMING_PATTERN);
  };
  const expectNoDrawdownFraming = (turn: string) => {
    expect(turn).not.toMatch(DRAWDOWN_FRAMING_PATTERN);
  };

  // Narrows an AllocationPhaseResult to its success branch so the rest of the
  // test can assert on the equity/buffer fields directly.
  const expectSuccess = (result: AllocationPhaseResult): AllocationPhaseOutput => {
    expect(result.status).toBe("completed");

    if (result.status !== "completed")
      throw new InternalError("expected allocation completed result");

    return result;
  };

  // Runs the phase end-to-end with the given user replies and captures the
  // transcript + result for the last-run artifact (written in afterEach).
  // Centralizing the capture means a new case can't forget to stash either value.
  const runAllocation = async (
    input: AllocationPhaseInput,
    replies: string[],
  ): Promise<{ transcript: TranscriptEntry[]; result: AllocationPhaseResult }> => {
    const responder = createTrackedResponder(replies);
    lastTranscript = responder.transcript;
    const result = await collectAllocation(input, responder);
    lastResult = result;

    return { transcript: responder.transcript, result };
  };

  // Runs the dev-only LLM judge over a finished conversation, stashes the
  // verdict for the last-run artifact, and fails the test if any criterion
  // failed — surfacing the judge's reason in the assertion message. Only the
  // LLM-composed turns are worth judging; deterministic text never varies.
  const judgeAndExpectPass = async (
    transcript: TranscriptEntry[],
    criteria: Parameters<typeof judgeAllocationConversation>[1],
  ): Promise<void> => {
    // judgeAllocationConversation guarantees one verdict per requested
    // criterion (it throws otherwise), so here we only check none failed.
    lastJudge = await judgeAllocationConversation(transcript, criteria);
    const failures = lastJudge.verdicts.filter((v) => !v.pass);

    expect(
      failures,
      failures.map((f) => `[${f.criterion}] ${f.reason}`).join("; "),
    ).toHaveLength(0);
  };

  beforeAll(() => initLastRun(LAST_RUN_PATH));

  afterEach((ctx) => {
    if (!lastTranscript) return;
    appendLastRunEntry(LAST_RUN_PATH, {
      name: ctx.task.name,
      passed: ctx.task.result?.state === "pass",
      transcript: lastTranscript,
      output: lastResult,
      judge: lastJudge,
      error: ctx.task.result?.errors?.[0]?.message,
    });
    lastTranscript = lastResult = lastJudge = undefined;
  });

  // clarify.allocation.rules.md rule 1 + 2: anchor proposal accepted as-is (happy path)
  it("should propose the cell-appropriate anchor and end on user acceptance", async () => {
    const { transcript, result } = await runAllocation(longHorizonAggressiveInput, [
      "Sounds good",
    ]);
    const output = expectSuccess(result);

    // aggressive + 10+ yr cell = 80–90%
    expectEquityInRange(output, 80, 90);
    expect(agentTurns(transcript)).toHaveLength(1);
    expectSplitConsistent(transcript, longHorizonAggressiveInput.amount, output);

    // behavioral framing must use "tends to reduce", never "prevents" or "eliminates"
    const text = agentText(transcript).toLowerCase();
    expect(text).toContain("tends to reduce");
    expect(text).not.toContain("prevents");
    expect(text).not.toContain("eliminates");
  });

  // clarify.allocation.rules.md rule 1: moderate 5–10yr lands in the 50–60% cell
  it("should land in the 50–60% cell for moderate risk + 5–10 year timeline", async () => {
    const { transcript, result } = await runAllocation(midHorizonModerateInput, ["ok"]);
    const output = expectSuccess(result);

    expectEquityInRange(output, 50, 60);
    expectSplitConsistent(transcript, midHorizonModerateInput.amount, output);
  });

  // clarify.allocation.rules.md rule 1 (within-cell discrimination): verifies the
  // LLM uses the precomputed proposal exactly across different cells. The expected
  // equity here is a hand-computed oracle for deriveAnchorEquityPercentage, which maps
  // scores {1,4} → cell.min (low edge), {2,5} → cell.max (high edge), {3} → midpoint.
  // Both rows below use a low-edge score, so equity == the cell's min; the default
  // fixtures cover the high edge (score 5 → 90, score 2 → 20).
  it.each<{
    fixture: AllocationPhaseInput;
    score: RiskTolerance;
    equity: number;
    buffer: number;
    label: string;
  }>([
    {
      fixture: longHorizonAggressiveInput,
      score: 4, // low edge of the 80–90 cell
      equity: 80,
      buffer: 20,
      label: "aggressive 10+ year, low edge",
    },
    {
      fixture: longHorizonConservativeInput,
      score: 1, // low edge of the 40–50 cell
      equity: 40,
      buffer: 60,
      label: "conservative 10+ year, low edge",
    },
  ])(
    "should propose $equity% equity for $label with riskTolerance=$score",
    async ({ fixture, score, equity, buffer }) => {
      const input: AllocationPhaseInput = { ...fixture, riskTolerance: score };
      const { transcript, result } = await runAllocation(input, ["Sounds good"]);
      const output = expectSuccess(result);

      expect(output.equityPercentage).toBe(equity);
      expect(output.bufferPercentage).toBe(buffer);
      expectSplitConsistent(transcript, input.amount, output);
    },
  );

  // clarify.allocation.rules.md rule 1: conservative 3–5yr lands in the 10–20% cell
  it("should land in the 10–20% cell for conservative risk + 3–5 year timeline", async () => {
    const { transcript, result } = await runAllocation(shortMidHorizonConservativeInput, [
      "ok",
    ]);
    const output = expectSuccess(result);

    expectEquityInRange(output, 10, 20);
    expectSplitConsistent(transcript, shortMidHorizonConservativeInput.amount, output);
  });

  // clarify.allocation.rules.md rule 3: non-round counter-proposal honored without snapping
  it("should honor a non-round counter-proposal exactly (no snap-to-cell)", async () => {
    const { transcript, result } = await runAllocation(longHorizonAggressiveInput, [
      "77%",
      "yes",
    ]);
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(77);
    expect(output.bufferPercentage).toBe(23);
    expectSplitConsistent(transcript, longHorizonAggressiveInput.amount, output);
    expectCounterTurnReferencesTimeline(transcript);

    await judgeAndExpectPass(transcript, [
      AllocationJudgeCriterionEnum.enum["framing-plain-language"],
      AllocationJudgeCriterionEnum.enum.conciseness,
      AllocationJudgeCriterionEnum.enum.naturalness,
    ]);
  });

  // clarify.allocation.rules.md rule 3: mid-size counter-proposal still honored (not extreme for profile)
  it("should honor a mid-size counter-proposal outside the cell when not extreme", async () => {
    const { transcript, result } = await runAllocation(longHorizonAggressiveInput, [
      "Let's do 50/50",
      "yes",
    ]);
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(50);
    expect(output.bufferPercentage).toBe(50);
    expectSplitConsistent(transcript, longHorizonAggressiveInput.amount, output);
    expectCounterTurnReferencesTimeline(transcript);
  });

  // clarify.allocation.rules.md rule 3 Branch 1 too-high: conservative user asks for 100% → sanity check fires with drawdown framing, accept
  it("should surface a sanity check when a conservative user asks for 100% stocks", async () => {
    const { transcript, result } = await runAllocation(longHorizonConservativeInput, [
      "Actually I want 100% stocks",
      "Yes, I'm sure",
    ]);
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(100);
    expect(output.bufferPercentage).toBe(0);
    // sanity-check turn should happen — at least 2 agent messages (proposal + sanity check)
    expectMinAgentTurns(transcript, 2);
    // Rule 3 Branch 1 (too-high direction): the sanity check must convey seriousness
    // via concrete drawdown numbers. Symmetric to the too-low test's negative guard.
    expectDrawdownFraming(agentTurns(transcript)[1].content.toLowerCase());
    expectSplitConsistent(transcript, longHorizonConservativeInput.amount, output);

    await judgeAndExpectPass(transcript, [
      AllocationJudgeCriterionEnum.enum["framing-plain-language"],
      AllocationJudgeCriterionEnum.enum.naturalness,
      AllocationJudgeCriterionEnum.enum["no-risk-labeling"],
    ]);
  });

  // clarify.allocation.rules.md rule 3 Branch 1 too-low: aggressive 10+ yr user asks for 0% equity → sanity check fires with opportunity-cost framing (no drawdown %), accept
  it("should surface a sanity check when a long-horizon aggressive user asks for 0% equity", async () => {
    const { transcript, result } = await runAllocation(longHorizonAggressiveInput, [
      "I want 0% stocks",
      "Yes, I'm sure",
    ]);
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(0);
    expect(output.bufferPercentage).toBe(100);
    expectMinAgentTurns(transcript, 2);
    // Rule 3 Branch 1 (too-low direction): the sanity check should use opportunity-cost
    // framing, not drawdown percentages — that framing belongs to the too-high direction.
    expectNoDrawdownFraming(agentTurns(transcript)[1].content.toLowerCase());
    expectSplitConsistent(transcript, longHorizonAggressiveInput.amount, output);

    await judgeAndExpectPass(transcript, [
      AllocationJudgeCriterionEnum.enum["framing-plain-language"],
      AllocationJudgeCriterionEnum.enum.naturalness,
      AllocationJudgeCriterionEnum.enum["no-risk-labeling"],
    ]);
  });

  // clarify.allocation.rules.md rule 4: clarifying question answered + re-ask, then accept
  it("should answer a clarifying question then return to the anchor proposal", async () => {
    const { transcript, result } = await runAllocation(longHorizonAggressiveInput, [
      "What's a buffer?",
      "Got it, sounds good",
    ]);
    const output = expectSuccess(result);

    expectEquityInRange(output, 80, 90);
    expectMinAgentTurns(transcript, 2);
    expectSplitConsistent(transcript, longHorizonAggressiveInput.amount, output);

    await judgeAndExpectPass(transcript, [
      AllocationJudgeCriterionEnum.enum["answer-scoping"],
      AllocationJudgeCriterionEnum.enum.conciseness,
      AllocationJudgeCriterionEnum.enum.naturalness,
      AllocationJudgeCriterionEnum.enum["no-risk-labeling"],
    ]);
  });

  // clarify.allocation.rules.md rule 4 (concept question, Hebrew instrument): the
  // user asks what a קרן כספית (money-market fund) is. Same composer path as the
  // "What's a buffer?" case, but exercises the Hebrew-instrument path: the user
  // asks with a Hebrew term, so the answer must name it inline yet keep the body
  // English (`english-body`) and must not pin a risk persona on the user
  // (`no-risk-labeling`). Also grades `answer-scoping`: a concept answer must
  // define only the asked term and stop — this turn previously bled into "why the
  // split exists", which the question composer's concept bullet now explicitly
  // forbids, so the guard belongs here.
  it("should answer a Hebrew concept question and re-ask the anchor", async () => {
    const { transcript, result } = await runAllocation(longHorizonAggressiveInput, [
      "What's a קרן כספית?",
      "Got it, sounds good",
    ]);
    const output = expectSuccess(result);

    expectEquityInRange(output, 80, 90);
    expectMinAgentTurns(transcript, 2);
    expectSplitConsistent(transcript, longHorizonAggressiveInput.amount, output);

    await judgeAndExpectPass(transcript, [
      AllocationJudgeCriterionEnum.enum["answer-scoping"],
      AllocationJudgeCriterionEnum.enum["english-body"],
      AllocationJudgeCriterionEnum.enum["no-risk-labeling"],
    ]);
  });

  // clarify.allocation.rules.md rule 4: method question answered without pinning a
  // risk persona on the user (the prime labeling-risk turn — "how did you decide?"
  // tempts "well, you're a moderate investor"). Graded by the judge's
  // no-risk-labeling criterion among the answer-turn criteria below.
  it("should answer a method question and re-ask the anchor", async () => {
    const { transcript, result } = await runAllocation(longHorizonAggressiveInput, [
      "How did you come up with that split?",
      "Got it, sounds good",
    ]);
    const output = expectSuccess(result);

    expectEquityInRange(output, 80, 90);
    expectMinAgentTurns(transcript, 2);
    expectSplitConsistent(transcript, longHorizonAggressiveInput.amount, output);

    await judgeAndExpectPass(transcript, [
      AllocationJudgeCriterionEnum.enum["answer-scoping"],
      AllocationJudgeCriterionEnum.enum.conciseness,
      AllocationJudgeCriterionEnum.enum.naturalness,
      AllocationJudgeCriterionEnum.enum["no-risk-labeling"],
    ]);
  });

  // clarify.allocation.rules.md rule 4: instrument question deflected to later phases
  it("should deflect an instrument question to later phases and re-ask the anchor", async () => {
    const { transcript, result } = await runAllocation(longHorizonAggressiveInput, [
      "Which ETF should I buy?",
      "Sounds good",
    ]);
    const output = expectSuccess(result);

    expectEquityInRange(output, 80, 90);
    expectMinAgentTurns(transcript, 2);
    expectSplitConsistent(transcript, longHorizonAggressiveInput.amount, output);

    await judgeAndExpectPass(transcript, [
      AllocationJudgeCriterionEnum.enum["answer-scoping"],
      AllocationJudgeCriterionEnum.enum.conciseness,
      AllocationJudgeCriterionEnum.enum.naturalness,
      AllocationJudgeCriterionEnum.enum["no-risk-labeling"],
    ]);
  });

  // clarify.allocation.rules.md rule 4 + rule 3: clarifying question followed by counter-proposal (3-turn worst case)
  it("should handle a clarifying question followed by a counter-proposal", async () => {
    const { transcript, result } = await runAllocation(longHorizonAggressiveInput, [
      "What's a buffer?",
      "Let's do 60/40",
      "yes",
    ]);
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(60);
    expect(output.bufferPercentage).toBe(40);
    // clarifying Q answer + re-ask + counter-proposal confirm = at least 3 agent turns
    expectMinAgentTurns(transcript, 3);
    // rule 3 Branch 2 (or borderline Branch 1) on the counter turn (index [2] —
    // [0]=initial proposal, [1]=clarifying answer + re-ask). The counter must
    // engage with the user's timeline; a bare confirmation with no framing is
    // a regression. Loose regex matches both Branch 2's "over your X horizon"
    // and Branch 1 too-low's "long-run growth … over many years" patterns.
    const counterTurn = agentTurns(transcript)[2].content.toLowerCase();
    expect(counterTurn).toMatch(TIMELINE_REFERENCE_PATTERN);
    expectSplitConsistent(transcript, longHorizonAggressiveInput.amount, output);
  });
});

// Classifier fidelity (ALLOCATION_AUDIT.md Finding 2). classifyTurn is the
// intent→data boundary: gpt-5.4-nano at effort:low reads the user's reply and the
// extracted proposedEquityPercentage becomes the portfolio split verbatim, with no
// programmatic guard on a *wrong* number (only counter-with-null re-parses). This
// block measures extraction/label accuracy against the real model, isolated from
// the composer and the full conversation. Exact-integer assertions are the right
// strength — the number is present verbatim in the reply (TESTING.md, Authoring).
// Per-case pass/fail accrues in clarify.allocation.runs.jsonl across manual runs;
// that trend is what decides whether the classifier needs a stronger model.
describe("classifyTurn", () => {
  // Minimal proposal-then-reply history. Extraction depends on the user reply, so
  // the assistant proposal is fixed context (65/35 on ₪100k) and the reply is the
  // only variable across cases — mirrors io.test.ts's proposalThenReply.
  const proposalThenReply = (userReply: string): EasyInputMessage[] => [
    {
      role: "assistant",
      content:
        "I'd propose ₪65,000 in stock ETFs and ₪35,000 in a buffer — roughly 65/35. Want that split, more in stocks, or more in buffer?",
    },
    { role: "user", content: userReply },
  ];

  // Counter extraction — the core of Finding 2. Assert both the label and the exact
  // equity integer: the number is verbatim in the reply, so tight equality is
  // correct. A near-miss (e.g. "make it 55" read as 50) is the silent-wrong-number
  // failure the audit flags, and it fails here.
  it.each<{ reply: string; expectedEquity: number }>([
    { reply: "60/40", expectedEquity: 60 },
    { reply: "make it 55", expectedEquity: 55 },
    { reply: "I want 77", expectedEquity: 77 },
    { reply: "70 stocks 30 buffer", expectedEquity: 70 },
    { reply: "more in stocks: 90", expectedEquity: 90 },
    { reply: "I want 0% stocks", expectedEquity: 0 },
    { reply: "100% stocks", expectedEquity: 100 },
  ])(
    'should extract $expectedEquity% equity from the counter reply "$reply"',
    async ({ reply, expectedEquity }) => {
      const intent = await classifyTurn(proposalThenReply(reply));

      expect(
        intent,
        `expected counter ${expectedEquity} for "${reply}", got ${JSON.stringify(intent)}`,
      ).toEqual({
        kind: AllocationIntentKindEnum.enum.counter,
        proposedEquityPercentage: expectedEquity,
      });
    },
  );

  // Label boundaries that gate whether a number is extracted at all. A number named
  // in an acceptance- or retraction-shaped reply must still route to counter (the
  // number wins, per the prompt); a numberless "more in stocks" must route to
  // unknown, never a guessed counter. Assert the kind, plus the integer where the
  // counter label carries one.
  it.each<{ reply: string; expectedKind: string; expectedEquity?: number }>([
    {
      reply: "let's do 50/50",
      expectedKind: AllocationIntentKindEnum.enum.counter,
      expectedEquity: 50,
    },
    {
      reply: "actually, stick with the original 88",
      expectedKind: AllocationIntentKindEnum.enum.counter,
      expectedEquity: 88,
    },
    { reply: "more in stocks", expectedKind: AllocationIntentKindEnum.enum.unknown },
    {
      reply: "stick with your original suggestion",
      expectedKind: AllocationIntentKindEnum.enum["accept-original"],
    },
    { reply: "ok", expectedKind: AllocationIntentKindEnum.enum.accept },
    { reply: "what's a buffer?", expectedKind: AllocationIntentKindEnum.enum.question },
  ])(
    'should classify "$reply" as $expectedKind',
    async ({ reply, expectedKind, expectedEquity }) => {
      const intent = await classifyTurn(proposalThenReply(reply));

      expect(
        intent.kind,
        `expected ${expectedKind} for "${reply}", got ${JSON.stringify(intent)}`,
      ).toBe(expectedKind);

      if (
        intent.kind === AllocationIntentKindEnum.enum.counter &&
        expectedEquity !== undefined
      )
        expect(intent.proposedEquityPercentage).toBe(expectedEquity);
    },
  );
});
