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

  // clarify.ef-debt.rules.md rule 1: mortgage is excluded from high-interest debt
  it("should clarify that mortgage does not count as high-interest debt", async () => {
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
    // phase ends silently — has EF, no debt
    expect(agentTurns[agentTurns.length - 1].content).not.toMatch(
      /unexpected expense|paying it off first|costs more than ETF/i,
    );
  });

  // clarify.ef-debt.rules.md rule 2: clarifying questions answered in 1–2 sentences — EF side
  it("should answer EF clarifying question using key facts", async () => {
    const responder = createTrackedResponder([
      "What counts as an emergency fund?",
      "Yes, I have one",
      "No debt",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const clarificationTurn = agentTurns.find((t) =>
      /3.6 months|liquid|savings|checking/i.test(t.content),
    );
    expect(clarificationTurn).toBeDefined();
    // phase ends silently — has EF, no debt
    expect(agentTurns[agentTurns.length - 1].content).not.toMatch(
      /unexpected expense|paying it off first|costs more than ETF/i,
    );
  });

  // clarify.ef-debt.rules.md rule 2: clarifying questions answered in 1–2 sentences — debt side
  it("should answer debt clarifying question using key facts", async () => {
    const responder = createTrackedResponder([
      "Yes, I have an emergency fund",
      "What's considered high-interest?",
      "No, I don't have any",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const clarificationTurn = agentTurns.find((t) =>
      /APR|percent|credit card|interest/i.test(t.content),
    );
    expect(clarificationTurn).toBeDefined();
    // phase ends silently — has EF, no debt
    expect(agentTurns[agentTurns.length - 1].content).not.toMatch(
      /unexpected expense|paying it off first|costs more than ETF/i,
    );
  });

  // clarify.ef-debt.rules.md rule 3: deflection → redirect back — EF side
  it("should redirect user back when they deflect the EF question", async () => {
    const responder = createTrackedResponder(["skip this", "Yes, I have one", "No debt"]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const redirectTurn = agentTurns.find((t) =>
      /need your answer|please answer|to continue/i.test(t.content),
    );
    expect(redirectTurn).toBeDefined();
  });

  // clarify.ef-debt.rules.md rule 3: deflection → redirect back — debt side
  it("should redirect user back when they deflect the debt question", async () => {
    const responder = createTrackedResponder([
      "Yes, I have an emergency fund",
      "I don't want to answer that",
      "No, no debt",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const redirectTurn = agentTurns.find((t) =>
      /need your answer|please answer|to continue/i.test(t.content),
    );
    expect(redirectTurn).toBeDefined();
  });

  // clarify.ef-debt.rules.md rule 4: ambiguous answer → ask for clarification — EF side
  it("should ask for clarification when EF answer is ambiguous", async () => {
    const responder = createTrackedResponder([
      "I have some savings",
      "Yes, I have a proper emergency fund",
      "No debt",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const clarificationTurn = agentTurns.find((t) =>
      /specific|3.6 months|liquid|savings account|clarify/i.test(t.content),
    );
    expect(clarificationTurn).toBeDefined();
  });

  // clarify.ef-debt.rules.md rule 5: mixed message — agent answers question, then confirms answer (EF side)
  it("should answer embedded question and confirm EF answer on mixed message", async () => {
    const responder = createTrackedResponder([
      "Yes, but does a savings account count?",
      "Yes, I have 6 months in savings",
      "No debt",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const mixedTurn = agentTurns.find((t) => /savings account|qualif/i.test(t.content));
    expect(mixedTurn).toBeDefined();
    // phase ends silently — has EF, no debt
    expect(agentTurns[agentTurns.length - 1].content).not.toMatch(
      /unexpected expense|paying it off first|costs more than ETF/i,
    );
  });

  // clarify.ef-debt.rules.md rule 5: mixed message — agent answers question, then confirms answer (debt side)
  it("should answer embedded question and confirm debt answer on mixed message", async () => {
    const responder = createTrackedResponder([
      "Yes, I have an emergency fund",
      "No, but does my car loan count?",
      "No, no high-interest debt",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const mixedTurn = agentTurns.find((t) => /car loan|mortgage|count/i.test(t.content));
    expect(mixedTurn).toBeDefined();
    // phase ends silently — has EF, no debt
    expect(agentTurns[agentTurns.length - 1].content).not.toMatch(
      /unexpected expense|paying it off first|costs more than ETF/i,
    );
  });

  // clarify.ef-debt.rules.md rule 6: EF follow-ups exhausted → defaults to no EF → education shown
  it("should default to no EF and show education when EF follow-ups are exhausted", async () => {
    const responder = createTrackedResponder([
      "I think so maybe?",
      "Sort of, kind of",
      "I'm really not sure",
      "No debt",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const lastMessage = agentTurns[agentTurns.length - 1].content;
    expect(lastMessage).toMatch(/unexpected expense|liquid account/i);
    expect(lastMessage).not.toMatch(/paying it off first|costs more than ETF/i);
  });

  // clarify.ef-debt.rules.md rule 6: debt follow-ups exhausted → defaults to has debt → education shown
  it("should default to has debt and show education when debt follow-ups are exhausted", async () => {
    const responder = createTrackedResponder([
      "Yes, I have an emergency fund",
      "I think I might have some",
      "Sort of?",
      "I'm not really sure",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const lastMessage = agentTurns[agentTurns.length - 1].content;
    expect(lastMessage).toMatch(/paying it off first|costs more than ETF/i);
    expect(lastMessage).not.toMatch(/unexpected expense|liquid account/i);
  });

  // clarify.ef-debt.rules.md rule 4: ambiguous answer → ask for clarification — debt side
  it("should ask for clarification when debt answer is ambiguous", async () => {
    const responder = createTrackedResponder([
      "Yes, I have an emergency fund",
      "kind of?",
      "Yes, I have credit card debt",
    ]);
    lastTranscript = responder.transcript;

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const clarificationTurn = agentTurns.find((t) =>
      /specific|credit card|APR|clarify/i.test(t.content),
    );
    expect(clarificationTurn).toBeDefined();
    // has debt → education shown
    expect(agentTurns[agentTurns.length - 1].content).toMatch(
      /paying it off first|costs more than ETF/i,
    );
  });
});
