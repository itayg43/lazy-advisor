import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { collectEfDebt } from "#pipeline/stages/clarify/ef-debt/clarify.ef-debt";

const LAST_RUN_PATH = new URL("clarify.ef-debt.last-run.md", import.meta.url).pathname;

const EF_EDUCATION_REGEX = /unexpected expense|liquid account/i;
const DEBT_EDUCATION_REGEX = /paying it off first|costs more than ETF/i;
const ANY_EDUCATION_REGEX = /unexpected expense|paying it off first|costs more than ETF/i;

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

    await collectEfDebt(responder);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const mortgageTurn = agentTurns.find((t) => /mortgage/i.test(t.content));
    expect(mortgageTurn).toBeDefined();
    // phase ends silently — has EF, no debt
    expect(agentTurns[agentTurns.length - 1].content).not.toMatch(ANY_EDUCATION_REGEX);
  });

  // clarify.ef-debt.rules.md rule 2: clarifying questions answered in 1–2 sentences
  it.each([
    {
      side: "EF",
      responses: ["What counts as an emergency fund?", "Yes, I have one", "No debt"],
      clarificationRegex: /3.6 months|liquid|savings|checking/i,
    },
    {
      side: "debt",
      responses: [
        "Yes, I have an emergency fund",
        "What's considered high-interest?",
        "No, I don't have any",
      ],
      clarificationRegex: /APR|percent|credit card|interest/i,
    },
  ])(
    "should answer $side clarifying question using key facts",
    async ({ responses, clarificationRegex }) => {
      const responder = createTrackedResponder(responses);
      lastTranscript = responder.transcript;

      await collectEfDebt(responder);

      const agentTurns = responder.transcript.filter((t) => t.role === "agent");
      const clarificationTurn = agentTurns.find((t) =>
        clarificationRegex.test(t.content),
      );
      expect(clarificationTurn).toBeDefined();
      // phase ends silently — has EF, no debt
      expect(agentTurns[agentTurns.length - 1].content).not.toMatch(ANY_EDUCATION_REGEX);
    },
  );

  // clarify.ef-debt.rules.md rule 3: deflection → redirect back
  it.each([
    {
      side: "EF",
      responses: ["skip this", "Yes, I have one", "No debt"],
    },
    {
      side: "debt",
      responses: [
        "Yes, I have an emergency fund",
        "I don't want to answer that",
        "No, no debt",
      ],
    },
  ])(
    "should redirect user back when they deflect the $side question",
    async ({ responses }) => {
      const responder = createTrackedResponder(responses);
      lastTranscript = responder.transcript;

      await collectEfDebt(responder);

      const agentTurns = responder.transcript.filter((t) => t.role === "agent");
      const redirectTurn = agentTurns.find((t) =>
        /need your answer|please answer|to continue/i.test(t.content),
      );
      expect(redirectTurn).toBeDefined();
    },
  );

  // clarify.ef-debt.rules.md rule 4: ambiguous answer → ask for clarification
  it.each([
    {
      side: "EF",
      responses: [
        "I have some savings",
        "Yes, I have a proper emergency fund",
        "No debt",
      ],
      clarificationRegex: /specific|3.6 months|liquid|savings account|clarify/i,
      finalEducationRegex: null,
    },
    {
      side: "debt",
      responses: [
        "Yes, I have an emergency fund",
        "kind of?",
        "Yes, I have credit card debt",
      ],
      clarificationRegex: /specific|credit card|APR|clarify/i,
      finalEducationRegex: DEBT_EDUCATION_REGEX,
    },
  ])(
    "should ask for clarification when $side answer is ambiguous",
    async ({ responses, clarificationRegex, finalEducationRegex }) => {
      const responder = createTrackedResponder(responses);
      lastTranscript = responder.transcript;

      await collectEfDebt(responder);

      const agentTurns = responder.transcript.filter((t) => t.role === "agent");
      const clarificationTurn = agentTurns.find((t) =>
        clarificationRegex.test(t.content),
      );
      expect(clarificationTurn).toBeDefined();
      if (finalEducationRegex) {
        expect(agentTurns[agentTurns.length - 1].content).toMatch(finalEducationRegex);
      }
    },
  );

  // clarify.ef-debt.rules.md rule 5: mixed message — agent answers question, then confirms answer
  it.each([
    {
      side: "EF",
      responses: [
        "Yes, but does a savings account count?",
        "Yes, I have 6 months in savings",
        "No debt",
      ],
      mixedRegex: /savings account|qualif/i,
    },
    {
      side: "debt",
      responses: [
        "Yes, I have an emergency fund",
        "No, but does my car loan count?",
        "No, no high-interest debt",
      ],
      mixedRegex: /car loan|mortgage|count/i,
    },
  ])(
    "should answer embedded question and confirm $side answer on mixed message",
    async ({ responses, mixedRegex }) => {
      const responder = createTrackedResponder(responses);
      lastTranscript = responder.transcript;

      await collectEfDebt(responder);

      const agentTurns = responder.transcript.filter((t) => t.role === "agent");
      const mixedTurn = agentTurns.find((t) => mixedRegex.test(t.content));
      expect(mixedTurn).toBeDefined();
      // phase ends silently — has EF, no debt
      expect(agentTurns[agentTurns.length - 1].content).not.toMatch(ANY_EDUCATION_REGEX);
    },
  );

  // clarify.ef-debt.rules.md rule 6: follow-ups exhausted → conservative default → education shown
  it.each([
    {
      side: "EF",
      responses: [
        "I think so maybe?",
        "Sort of, kind of",
        "I'm really not sure",
        "No debt",
      ],
      expectedEducationRegex: EF_EDUCATION_REGEX,
      otherEducationRegex: DEBT_EDUCATION_REGEX,
    },
    {
      side: "debt",
      responses: [
        "Yes, I have an emergency fund",
        "I think I might have some",
        "Sort of?",
        "I'm not really sure",
      ],
      expectedEducationRegex: DEBT_EDUCATION_REGEX,
      otherEducationRegex: EF_EDUCATION_REGEX,
    },
  ])(
    "should default conservatively and show $side education when $side follow-ups are exhausted",
    async ({ responses, expectedEducationRegex, otherEducationRegex }) => {
      const responder = createTrackedResponder(responses);
      lastTranscript = responder.transcript;

      await collectEfDebt(responder);

      const agentTurns = responder.transcript.filter((t) => t.role === "agent");
      const lastMessage = agentTurns[agentTurns.length - 1].content;
      expect(lastMessage).toMatch(expectedEducationRegex);
      expect(lastMessage).not.toMatch(otherEducationRegex);
    },
  );
});
