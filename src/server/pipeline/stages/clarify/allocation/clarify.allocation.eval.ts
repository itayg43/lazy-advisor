import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { InternalError } from "#errors";
import { appendLastRunEntry, initLastRun } from "#pipeline/eval.last-run";
import { createTrackedResponder, type TranscriptEntry } from "#pipeline/eval.transcript";
import { collectAllocation } from "#pipeline/stages/clarify/allocation/clarify.allocation";
import { ALLOCATION_UNKNOWN_INTENT_MESSAGE } from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import {
  AllocationJudgeCriterionEnum,
  judgeAllocationConversation,
  type AllocationJudgeOutput,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.judge";
import type {
  AllocationPhaseInput,
  AllocationPhaseOutput,
  AllocationPhaseResult,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import type { RiskSelfRatingScore } from "#pipeline/stages/clarify/risk/clarify.risk.types";
import { RiskToleranceEnum, TimelineBucketEnum } from "#schemas/pipeline.schemas";

const LAST_RUN_PATH = new URL("clarify.allocation.last-run.md", import.meta.url).pathname;

const { conservative, moderate, aggressive } = RiskToleranceEnum.enum;

describe("collectAllocation", () => {
  // Mutable capture for the last-run artifact: each test stashes its transcript,
  // result, and judge verdict here; afterEach writes them and resets to undefined.
  let lastTranscript: TranscriptEntry[] | undefined;
  let lastOutput: AllocationPhaseResult | undefined;
  let lastJudge: AllocationJudgeOutput | undefined;

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

  // Criteria shared by the cases that exercise the same turn type. An extreme
  // sanity-check turn is graded on its framing and tone; a question-answer turn
  // is graded on scope, length, and tone. Cases with a one-off mix pass their
  // criteria inline.
  const EXTREME_TURN_CRITERIA = [
    AllocationJudgeCriterionEnum.enum["framing-plain-language"],
    AllocationJudgeCriterionEnum.enum.naturalness,
  ];
  const ANSWER_TURN_CRITERIA = [
    AllocationJudgeCriterionEnum.enum["answer-scoping"],
    AllocationJudgeCriterionEnum.enum.conciseness,
    AllocationJudgeCriterionEnum.enum.naturalness,
  ];

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

  // Internal risk-tolerance labels must never reach the user — not even as
  // general adjectives (clarify.allocation.rules.md, Anchor Table preamble + rule 4).
  const expectNoInternalLabels = (transcript: TranscriptEntry[]) => {
    const text = agentText(transcript).toLowerCase();
    expect(text).not.toContain("aggressive");
    expect(text).not.toContain("conservative");
    expect(text).not.toContain("moderate");
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
    const expectedEquityAmount = (amount * output.equityPercentage) / 100;
    const expectedBufferAmount = amount - expectedEquityAmount;
    const text = agentText(transcript);
    if (output.equityPercentage > 0) {
      expect(text).toContain(`₪${expectedEquityAmount.toLocaleString("en-US")}`);
    }
    if (output.bufferPercentage > 0) {
      expect(text).toContain(`₪${expectedBufferAmount.toLocaleString("en-US")}`);
    }
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
    lastOutput = result;

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
      output: lastOutput,
      judge: lastJudge,
      error: ctx.task.result?.errors?.[0]?.message,
    });
    lastTranscript = lastOutput = lastJudge = undefined;
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
    expectShekelMathConsistent(transcript, longHorizonAggressiveInput.amount, output);

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
    expectShekelMathConsistent(transcript, midHorizonModerateInput.amount, output);
  });

  // clarify.allocation.rules.md rule 1 (within-bucket discrimination): verifies the
  // LLM uses the precomputed proposal exactly across different cells. The expected
  // equity here is a hand-computed oracle for deriveAnchorEquityPercentage, which maps
  // scores {1,4} → cell.min (low edge), {2,5} → cell.max (high edge), {3} → midpoint.
  // Both rows below use a low-edge score, so equity == the cell's min; the default
  // fixtures cover the high edge (score 5 → 90, score 2 → 20).
  it.each<{
    fixture: AllocationPhaseInput;
    score: RiskSelfRatingScore;
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
    "should propose $equity% equity for $label with riskSelfRatingScore=$score",
    async ({ fixture, score, equity, buffer }) => {
      const input: AllocationPhaseInput = { ...fixture, riskSelfRatingScore: score };
      const { transcript, result } = await runAllocation(input, ["Sounds good"]);
      const output = expectSuccess(result);

      expect(output.equityPercentage).toBe(equity);
      expect(output.bufferPercentage).toBe(buffer);
      expectShekelMathConsistent(transcript, input.amount, output);
    },
  );

  // clarify.allocation.rules.md rule 1: conservative 3–5yr lands in the 10–20% cell
  it("should land in the 10–20% cell for conservative risk + 3–5 year timeline", async () => {
    const { transcript, result } = await runAllocation(shortMidHorizonConservativeInput, [
      "ok",
    ]);
    const output = expectSuccess(result);

    expectEquityInRange(output, 10, 20);
    expectShekelMathConsistent(
      transcript,
      shortMidHorizonConservativeInput.amount,
      output,
    );
  });

  // clarify.allocation.rules.md rule 2 (accept-original): after countering, the
  // user retracts to the original anchor without naming a number. Classifier
  // returns `accept-original`; handler resolves to anchorEquityPercentage, not the latest
  // counter.
  it("should resolve to the anchor when the user retracts to the original proposal", async () => {
    const { result } = await runAllocation(longHorizonAggressiveInput, [
      "Make it 60%",
      "Actually, never mind — stick with your original suggestion",
    ]);
    const output = expectSuccess(result);

    // aggressive + 10+ yr + score 5 → anchor = 90% (cell.max), not 60
    expect(output.equityPercentage).toBe(90);
    expect(output.bufferPercentage).toBe(10);
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
    expectShekelMathConsistent(transcript, longHorizonAggressiveInput.amount, output);
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
    expectShekelMathConsistent(transcript, longHorizonAggressiveInput.amount, output);
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
    expectShekelMathConsistent(transcript, longHorizonConservativeInput.amount, output);

    await judgeAndExpectPass(transcript, EXTREME_TURN_CRITERIA);
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
    expectShekelMathConsistent(transcript, longHorizonAggressiveInput.amount, output);

    await judgeAndExpectPass(transcript, EXTREME_TURN_CRITERIA);
  });

  // clarify.allocation.rules.md rule 3 Branch 3 (repeated counter-proposals):
  // compound-impact framing lands once per conversation. The first counter
  // confirmation must reference the user's timeline (Branch 2); the second
  // counter confirmation must omit the framing and just confirm the new split
  // (Branch 3). Tight regex on "over your … (year|horizon|timeline)" — looser
  // matches like "long-run growth" appear in many turns as filler and would
  // over-trigger.
  it("should omit compound-impact framing on a repeated counter-proposal", async () => {
    const { transcript, result } = await runAllocation(longHorizonAggressiveInput, [
      "Make it 60%",
      "Actually 55%",
      "Yes",
    ]);
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(55);
    expect(output.bufferPercentage).toBe(45);

    const turns = agentTurns(transcript);
    const compoundImpactPattern =
      /(?:over|with|across) your[^.]{0,40}(?:year|horizon|timeline)/i;
    expect(turns[1].content).toMatch(compoundImpactPattern);
    expect(turns[2].content).not.toMatch(compoundImpactPattern);

    expectShekelMathConsistent(transcript, longHorizonAggressiveInput.amount, output);
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
    expectShekelMathConsistent(transcript, longHorizonAggressiveInput.amount, output);

    await judgeAndExpectPass(transcript, ANSWER_TURN_CRITERIA);
  });

  // clarify.allocation.rules.md rule 4 (concept question, Hebrew instrument): the
  // user asks what a קרן כספית (money-market fund) is. Same composer path as the
  // "What's a buffer?" case, but guards the English-body / Hebrew-inline hard rule —
  // the answer may name the Hebrew term inline but must stay in English prose and
  // must not leak internal risk labels.
  it("should answer a Hebrew concept question and re-ask the anchor", async () => {
    const { transcript, result } = await runAllocation(longHorizonAggressiveInput, [
      "What's a קרן כספית?",
      "Got it, sounds good",
    ]);
    const output = expectSuccess(result);

    expectEquityInRange(output, 80, 90);
    expectMinAgentTurns(transcript, 2);
    expectNoInternalLabels(transcript);
    expectShekelMathConsistent(transcript, longHorizonAggressiveInput.amount, output);
  });

  // clarify.allocation.rules.md rule 4: method question answered without exposing internal labels
  it("should answer a method question and re-ask the anchor", async () => {
    const { transcript, result } = await runAllocation(longHorizonAggressiveInput, [
      "How did you come up with that split?",
      "Got it, sounds good",
    ]);
    const output = expectSuccess(result);

    expectEquityInRange(output, 80, 90);
    expectMinAgentTurns(transcript, 2);
    expectNoInternalLabels(transcript);
    expectShekelMathConsistent(transcript, longHorizonAggressiveInput.amount, output);

    await judgeAndExpectPass(transcript, ANSWER_TURN_CRITERIA);
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
    expectShekelMathConsistent(transcript, longHorizonAggressiveInput.amount, output);

    await judgeAndExpectPass(transcript, ANSWER_TURN_CRITERIA);
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
    expectShekelMathConsistent(transcript, longHorizonAggressiveInput.amount, output);
  });

  // clarify.allocation.rules.md rule 5: an unparseable / numberless reply ("more
  // in stocks" with no number) classifies as `unknown` → the handler re-asks with
  // the fixed generic prompt and the phase stays open. The constant is rendered in
  // code (not the LLM), so assert on it exactly. A following accept then closes.
  it("should re-ask with the generic prompt on an unparseable reply", async () => {
    const { transcript, result } = await runAllocation(longHorizonAggressiveInput, [
      "more in stocks",
      "Sounds good",
    ]);
    const output = expectSuccess(result);

    expectEquityInRange(output, 80, 90);
    expect(agentText(transcript)).toContain(ALLOCATION_UNKNOWN_INTENT_MESSAGE);
  });

  // clarify.allocation.rules.md "Budget exhaustion": accept on the
  // MAX_NEGOTIATION_TURNS-th turn wins — the handler classifies first and
  // resolves to `completed` rather than throwing the user's "yes" away. 4
  // counters + 1 accept = 5 turns total (MAX_NEGOTIATION_TURNS). Final equity
  // is the last counter's value.
  it("should accept on the MAX_NEGOTIATION_TURNS-th turn instead of returning unresolved", async () => {
    const { result } = await runAllocation(longHorizonAggressiveInput, [
      "Actually I want 60% stocks",
      "Wait, let's do 55%",
      "Sorry, change to 50%",
      "Actually 45%",
      "Yes, lock it in",
    ]);
    const output = expectSuccess(result);

    expect(output.equityPercentage).toBe(45);
    expect(output.bufferPercentage).toBe(55);
  });

  // clarify.allocation.rules.md "Budget exhaustion": a chain of counter-proposals
  // exhausts the turn budget threaded via state (MAX_NEGOTIATION_TURNS = 5 in
  // clarify.allocation.constants.ts).
  // On the budget-th turn, the handler returns `Done` with
  // { status: "unresolved", reason: "allocation" } before composing another reply.
  it("should return failure when the user keeps counter-proposing past the turn budget", async () => {
    const { result } = await runAllocation(longHorizonAggressiveInput, [
      "Actually I want 60% stocks",
      "Wait, let's do 55%",
      "Sorry, change to 50%",
      "Actually 45%",
      "Make it 40%",
      "Hmm, 35%",
      "OK 30%",
    ]);

    expect(result.status).toBe("unresolved");
    if (result.status !== "unresolved") return;
    expect(result.reason).toBe("allocation");
  });
});
