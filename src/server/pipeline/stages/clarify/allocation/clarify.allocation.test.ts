import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackedResponder } from "#pipeline/eval.transcript";
import { collectAllocation } from "#pipeline/stages/clarify/allocation/clarify.allocation";
import {
  ALLOCATION_MAX_TOTAL_TURNS,
  ALLOCATION_UNKNOWN_INTENT_MESSAGE,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import * as allocationIO from "#pipeline/stages/clarify/allocation/clarify.allocation.io";
import {
  AllocationCounterBranchKindEnum,
  AllocationExtremeCounterDirectionEnum,
  AllocationIntentKindEnum,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type {
  AllocationClassifierOutput,
  AllocationPhaseInput,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import { PipelineStatusEnum, TimelineBucketEnum } from "#schemas/pipeline.schemas";
import type { OpenAIResponse } from "#services/openai";

// Mock only the OpenAI boundary — not the io module — per TESTING.md § Mocking.
// The turn logic under test (gate order, intent routing, budget, framing
// threading) plus classifyTurn's re-parse and the composers' branch rendering
// all run for real; callOpenAIParsed is the single external call they bottom out
// in. The composers are additionally wrapped by *observer* spies below: those
// call through to the real implementation, they don't replace it — they just
// record the typed args the turn logic hands across the allocation↔io seam.
const { mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("collectAllocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reverts the observer spies created per test so they don't stack across
    // cases (TESTING.md § Mocking — clearAllMocks then restoreAllMocks).
    vi.restoreAllMocks();
  });

  const {
    accept,
    "accept-original": acceptOriginal,
    counter,
    question,
    unknown,
  } = AllocationIntentKindEnum.enum;
  const {
    extreme,
    "compound-impact": compoundImpact,
    bare,
  } = AllocationCounterBranchKindEnum.enum;
  const { "too-low": tooLow } = AllocationExtremeCounterDirectionEnum.enum;

  // Aggressive (score 5) + 10+ years keys the 80–90 anchor cell; score 5 selects
  // the high edge, so deriveAnchorEquityPercentage returns 90. Hand-computed
  // oracle (TESTING.md § Authoring): the anchor the phase opens on when the user
  // never counters, and the value `accept-original` retracts to.
  const longHorizonAggressiveInput: AllocationPhaseInput = {
    amount: 50_000,
    timeline: TimelineBucketEnum.enum["10+ years"],
    riskTolerance: 5,
  };
  const ANCHOR_EQUITY_PERCENTAGE = 90;

  const createParsedResponse = <T>(output: T): OpenAIResponse<T> => ({
    id: "resp_test",
    usage: undefined,
    output,
  });

  // A user turn drives one or two boundary calls, always classify then (maybe)
  // compose. Queueing per turn keeps each test reading as the conversation it
  // scripts; mockResolvedValueOnce vends the responses in FIFO call order.
  const queueClassify = (output: AllocationClassifierOutput) => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(createParsedResponse(output));
  };
  // The composed reply text is irrelevant to turn logic (its prose quality is an
  // eval concern); every composer call returns the same placeholder.
  const queueCompose = () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse({ reply: "Reply." }),
    );
  };
  const queueCounterTurn = (proposedEquityPercentage: number) => {
    queueClassify({ kind: counter, proposedEquityPercentage });
    queueCompose();
  };
  const queueQuestionTurn = () => {
    queueClassify({ kind: question, proposedEquityPercentage: null });
    queueCompose();
  };

  const agentText = (
    transcript: ReturnType<typeof createTrackedResponder>["transcript"],
  ) =>
    transcript
      .filter((entry) => entry.role === "agent")
      .map((entry) => entry.content)
      .join(" ");

  // clarify.allocation.rules.md rule 2: a clear yes to the current split completes
  // the phase. `accept` resolves to the *current* proposal (the latest counter);
  // `accept-original` retracts to the untouched anchor. Both cases counter once to
  // 60 first, so the divergence — current (60) vs anchor (90) — is what's tested.
  it.each<{
    label: string;
    finalKind: AllocationClassifierOutput["kind"];
    equity: number;
  }>([
    { label: "accept resolves to the current counter", finalKind: accept, equity: 60 },
    {
      label: "accept-original resolves to the original anchor",
      finalKind: acceptOriginal,
      equity: ANCHOR_EQUITY_PERCENTAGE,
    },
  ])("should complete where $label", async ({ finalKind, equity }) => {
    queueCounterTurn(60);
    queueClassify({ kind: finalKind, proposedEquityPercentage: null });
    const responder = createTrackedResponder(["make it 60%", "yes"]);

    const result = await collectAllocation(longHorizonAggressiveInput, responder);

    expect(result).toEqual({
      status: PipelineStatusEnum.enum.completed,
      equityPercentage: equity,
      bufferPercentage: 100 - equity,
    });
  });

  // clarify.allocation.rules.md § Budget exhaustion gate 1: accept is gated ahead of
  // both budget checks, so a yes still completes even once the negotiation budget is
  // spent. Five counters bring negotiationTurnsTaken to MAX_NEGOTIATION_TURNS; a
  // sixth-turn accept resolves to the latest counter (50) rather than exhausting.
  it("should complete on an accept once the negotiation budget is spent", async () => {
    queueCounterTurn(60);
    queueCounterTurn(58);
    queueCounterTurn(56);
    queueCounterTurn(54);
    queueCounterTurn(50);
    queueClassify({ kind: accept, proposedEquityPercentage: null });
    const responder = createTrackedResponder(["60%", "58%", "56%", "54%", "50%", "yes"]);

    const result = await collectAllocation(longHorizonAggressiveInput, responder);

    expect(result).toEqual({
      status: PipelineStatusEnum.enum.completed,
      equityPercentage: 50,
      bufferPercentage: 50,
    });
  });

  // clarify.allocation.rules.md rule 3: the counter branch is selected in code and
  // its framing flags are sticky across turns. Three identical extreme counters
  // (40% is 40 pp below the 80–90 range) must escalate through each framing once:
  // extreme (first) → compound-impact (extreme already shown) → bare (both shown).
  // Observed via the composer spy's typed branch arg — proves the negotiation
  // state threads correctly turn-to-turn (the pure selection is unit-tested in
  // isolation in clarify.allocation.lib.test.ts).
  it("should escalate the counter framing branch once per framing across turns", async () => {
    queueCounterTurn(40);
    queueCounterTurn(40);
    queueCounterTurn(40);
    queueClassify({ kind: accept, proposedEquityPercentage: null });
    const composeCounterSpy = vi.spyOn(allocationIO, "composeCounterReply");
    const responder = createTrackedResponder(["40%", "still 40%", "keep 40%", "yes"]);

    const result = await collectAllocation(longHorizonAggressiveInput, responder);

    expect(result).toEqual({
      status: PipelineStatusEnum.enum.completed,
      equityPercentage: 40,
      bufferPercentage: 60,
    });
    expect(composeCounterSpy).toHaveBeenCalledTimes(3);
    // `mock.calls[i][j]` is the j-th argument of the i-th recorded call. The
    // composer's first parameter (index 0) is the selected AllocationCounterBranch,
    // so `calls[turn][0]` is the branch handed to the composer on that turn.
    expect(composeCounterSpy.mock.calls[0][0]).toEqual({
      kind: extreme,
      direction: tooLow,
    });
    expect(composeCounterSpy.mock.calls[1][0]).toEqual({ kind: compoundImpact });
    expect(composeCounterSpy.mock.calls[2][0]).toEqual({ kind: bare });
  });

  // clarify.allocation.rules.md rule 5: an `unknown` intent re-asks with the fixed
  // ALLOCATION_UNKNOWN_INTENT_MESSAGE (rendered in code, no composer call) and the
  // phase stays open; a following accept then closes it at the untouched anchor.
  it("should re-ask with the generic prompt on an unknown intent then complete", async () => {
    queueClassify({ kind: unknown, proposedEquityPercentage: null });
    queueClassify({ kind: accept, proposedEquityPercentage: null });
    const composeCounterSpy = vi.spyOn(allocationIO, "composeCounterReply");
    const composeQuestionSpy = vi.spyOn(allocationIO, "composeQuestionReply");
    const responder = createTrackedResponder(["more in stocks", "sounds good"]);

    const result = await collectAllocation(longHorizonAggressiveInput, responder);

    expect(result).toEqual({
      status: PipelineStatusEnum.enum.completed,
      equityPercentage: ANCHOR_EQUITY_PERCENTAGE,
      bufferPercentage: 100 - ANCHOR_EQUITY_PERCENTAGE,
    });
    expect(agentText(responder.transcript)).toContain(ALLOCATION_UNKNOWN_INTENT_MESSAGE);
    // The unknown branch re-asks a constant — it must not reach either composer.
    expect(composeCounterSpy).not.toHaveBeenCalled();
    expect(composeQuestionSpy).not.toHaveBeenCalled();
  });

  // clarify.allocation.rules.md § Budget exhaustion gate 3: a chain of counters with
  // no accept exhausts the negotiation budget. Five counters are served
  // (negotiationTurnsTaken → MAX_NEGOTIATION_TURNS); the sixth counter hits the
  // negotiation gate, which returns unresolved *before* composing — so only the
  // first five turns reach the composer.
  it("should resolve unresolved/allocation when counters exhaust the negotiation budget", async () => {
    queueCounterTurn(60);
    queueCounterTurn(58);
    queueCounterTurn(56);
    queueCounterTurn(54);
    queueCounterTurn(52);
    // 6th turn: classify only — the negotiation gate short-circuits before compose.
    // The counter still carries a real number so classifyTurn's re-parse passes.
    queueClassify({ kind: counter, proposedEquityPercentage: 50 });
    const composeCounterSpy = vi.spyOn(allocationIO, "composeCounterReply");
    const responder = createTrackedResponder(["60%", "58%", "56%", "54%", "52%", "50%"]);

    const result = await collectAllocation(longHorizonAggressiveInput, responder);

    expect(result).toEqual({ status: PipelineStatusEnum.enum.unresolved });
    expect(composeCounterSpy).toHaveBeenCalledTimes(5);
  });

  // clarify.allocation.rules.md § Turn budget: only counters advance the negotiation
  // budget — questions never do. Six clarifying questions (past MAX_NEGOTIATION_TURNS)
  // keep the phase open; a following accept still completes at the untouched anchor,
  // which is only possible if the questions didn't spend the negotiation budget.
  it("should not count questions against the negotiation budget", async () => {
    queueQuestionTurn();
    queueQuestionTurn();
    queueQuestionTurn();
    queueQuestionTurn();
    queueQuestionTurn();
    queueQuestionTurn();
    queueClassify({ kind: accept, proposedEquityPercentage: null });
    const composeQuestionSpy = vi.spyOn(allocationIO, "composeQuestionReply");
    const responder = createTrackedResponder([
      "what's a buffer?",
      "and equity?",
      "why split at all?",
      "how did you decide?",
      "what's a money-market fund?",
      "one more thing",
      "sounds good",
    ]);

    const result = await collectAllocation(longHorizonAggressiveInput, responder);

    expect(result).toEqual({
      status: PipelineStatusEnum.enum.completed,
      equityPercentage: ANCHOR_EQUITY_PERCENTAGE,
      bufferPercentage: 100 - ANCHOR_EQUITY_PERCENTAGE,
    });
    expect(composeQuestionSpy).toHaveBeenCalledTimes(6);
  });

  // clarify.allocation.rules.md § Budget exhaustion gate 2: the total-turn backstop
  // bounds a conversation that never converges. MAX_TOTAL_TURNS questions are served
  // (totalTurnsTaken → MAX_TOTAL_TURNS); the next turn hits the total gate and returns
  // unresolved before composing — so only the served turns reach the composer. The
  // classifier is mocked, so the question text is inert — plain placeholders make that
  // explicit, and binding the counts to the constant keeps them in lockstep with it.
  it("should resolve unresolved/allocation when total turns are exhausted", async () => {
    for (let turn = 0; turn < ALLOCATION_MAX_TOTAL_TURNS; turn++) queueQuestionTurn();
    // One past the cap: classify only — the total gate short-circuits before compose.
    queueClassify({ kind: question, proposedEquityPercentage: null });
    const composeQuestionSpy = vi.spyOn(allocationIO, "composeQuestionReply");
    const responder = createTrackedResponder(
      Array.from(
        { length: ALLOCATION_MAX_TOTAL_TURNS + 1 },
        (_, turn) => `question ${turn + 1}`,
      ),
    );

    const result = await collectAllocation(longHorizonAggressiveInput, responder);

    expect(result).toEqual({ status: PipelineStatusEnum.enum.unresolved });
    expect(composeQuestionSpy).toHaveBeenCalledTimes(ALLOCATION_MAX_TOTAL_TURNS);
  });
});
