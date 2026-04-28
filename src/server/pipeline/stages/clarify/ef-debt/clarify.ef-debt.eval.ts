import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { collectEfDebt } from "#pipeline/stages/clarify/ef-debt/clarify.ef-debt";

const LAST_RUN_PATH = new URL("clarify.ef-debt.last-run.md", import.meta.url).pathname;

describe("collectEfDebt", () => {
  let lastTranscript: TranscriptEntry[] | undefined;

  beforeAll(() => initLastRun(LAST_RUN_PATH));

  afterEach((ctx) => {
    if (!lastTranscript) return;
    appendLastRunEntry(LAST_RUN_PATH, {
      name: ctx.task.name,
      passed: ctx.task.result?.state === "pass",
      transcript: lastTranscript,
    });
    lastTranscript = undefined;
  });

  // clarify.ef-debt.rules.md rule 1: EF asked first, debt second — in separate turns
  it("should ask emergency fund first then debt in separate turns", async () => {
    const responder = createTrackedResponder([
      "Yes, I have an emergency fund",
      "No high-interest debt",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns.length).toBeGreaterThanOrEqual(2);
    expect(agentTurns[0].content).toMatch(/emergency fund/i);
    expect(agentTurns[1].content).toMatch(/high.interest debt/i);
  });

  // clarify.ef-debt.rules.md rule 2: education deferred — no educational content between the two questions
  it("should not send educational content between the EF and debt questions", async () => {
    const responder = createTrackedResponder([
      "No, I don't have an emergency fund",
      "No credit card debt",
      "Yes, I'll continue anyway",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const debtQuestionIndex = agentTurns.findIndex((t) =>
      /high.interest debt/i.test(t.content),
    );
    const educationIndex = agentTurns.findIndex((t) =>
      /unexpected expense|sell investments/i.test(t.content),
    );
    expect(debtQuestionIndex).toBeGreaterThanOrEqual(0);
    expect(educationIndex).toBeGreaterThan(debtQuestionIndex);
  });

  // clarify.ef-debt.rules.md rule 3: no concerns → phase ends silently (no extra message)
  it("should end silently when user has an emergency fund and no high-interest debt", async () => {
    const responder = createTrackedResponder([
      "Yes, I have an emergency fund",
      "No high-interest debt",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns).toHaveLength(2);
    expect(agentTurns[1].content).not.toMatch(/proceed|continue|anyway/i);
  });

  // clarify.ef-debt.rules.md rule 4: missing EF → educational message + "proceed?"
  it("should send educational message and ask proceed when user has no emergency fund", async () => {
    const responder = createTrackedResponder([
      "No, I don't have an emergency fund",
      "No credit card debt",
      "Yes, I'd like to continue",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const educationTurn = agentTurns.find((t) =>
      /proceed|continue|anyway/i.test(t.content),
    );
    expect(educationTurn).toBeDefined();
    expect(educationTurn?.content).toMatch(/emergency fund|unexpected expense/i);
  });

  // clarify.ef-debt.rules.md rule 4: high-interest debt alone → educational message + "proceed?"
  it("should send educational message and ask proceed when user has high-interest debt", async () => {
    const responder = createTrackedResponder([
      "Yes, I have an emergency fund",
      "Yes, I have credit card debt",
      "Yes, I'd like to continue",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const educationTurn = agentTurns.find((t) =>
      /proceed|continue|anyway/i.test(t.content),
    );
    expect(educationTurn).toBeDefined();
    expect(educationTurn?.content).toMatch(/high.interest|credit card|APR/i);
  });

  // clarify.ef-debt.rules.md rule 5: phase ends after "proceed?" response regardless of answer
  it("should end after user declines to proceed", async () => {
    const responder = createTrackedResponder([
      "No, I don't have an emergency fund",
      "No, I don't have any high-interest debt",
      "No, I'll wait",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    // All 3 scripted responses were consumed — phase ended without looping
    expect(responder.transcript.filter((t) => t.role === "user")).toHaveLength(3);
  });

  // clarify.ef-debt.rules.md rule 6: mortgage clarification → excluded, re-asks debt only
  it("should clarify that mortgage does not count and re-ask the debt question", async () => {
    const responder = createTrackedResponder([
      "Yes, I have an emergency fund",
      "Does my mortgage count?",
      "No, no other debt",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const mortgageTurn = agentTurns.find((t) => /mortgage/i.test(t.content));
    expect(mortgageTurn).toBeDefined();
    // All 3 user responses consumed — debt question was re-asked and answered
    expect(responder.transcript.filter((t) => t.role === "user")).toHaveLength(3);
    // Phase ended silently (has EF + no debt)
    expect(agentTurns[agentTurns.length - 1].content).not.toMatch(
      /proceed|continue|anyway/i,
    );
  });

  // clarify.ef-debt.rules.md rule 7: other clarifying questions re-ask current question only
  it("should answer EF clarifying question and re-ask EF only — not debt", async () => {
    const responder = createTrackedResponder([
      "What counts as an emergency fund?",
      "Yes, I have one",
      "No debt",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const clarificationTurn = agentTurns.find((t) =>
      /3.6 months|liquid account|living expenses/i.test(t.content),
    );
    expect(clarificationTurn).toBeDefined();
    expect(clarificationTurn?.content).not.toMatch(/high.interest debt|credit card/i);
  });
});
