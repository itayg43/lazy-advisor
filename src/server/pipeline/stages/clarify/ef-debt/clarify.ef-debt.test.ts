import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackedResponder } from "#pipeline/eval.transcript";
import {
  collectEfDebt,
  type EmergencyFundClassify,
} from "#pipeline/stages/clarify/ef-debt/clarify.ef-debt";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("collectEfDebt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createParsedResponse = <T>(output: T): OpenAIResponse<T> => ({
    id: "resp_test",
    usage: undefined,
    output,
  });

  const answerYes: OpenAIResponse<EmergencyFundClassify> = createParsedResponse({
    clarificationNeeded: false,
    clarificationMessage: null,
    answer: "yes",
  });
  const answerNo: OpenAIResponse<EmergencyFundClassify> = createParsedResponse({
    clarificationNeeded: false,
    clarificationMessage: null,
    answer: "no",
  });
  const needsClarification: OpenAIResponse<EmergencyFundClassify> = createParsedResponse({
    clarificationNeeded: true,
    clarificationMessage: "Can you clarify?",
    answer: null,
  });

  it("should end silently when user has EF and no debt", async () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(answerYes)
      .mockResolvedValueOnce(answerNo);
    const responder = createTrackedResponder(["Yes", "No"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns).toHaveLength(2);
  });

  it("should send EF education only when user has no emergency fund and no debt", async () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(answerNo)
      .mockResolvedValueOnce(answerNo);
    const responder = createTrackedResponder(["No", "No"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const educationTurn = agentTurns[agentTurns.length - 1];
    expect(educationTurn.content).toMatch(/unexpected expense/i);
    expect(educationTurn.content).not.toMatch(/paying it off first|costs more than ETF/i);
  });

  it("should send debt education only when user has EF and high-interest debt", async () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(answerYes)
      .mockResolvedValueOnce(answerYes);
    const responder = createTrackedResponder(["Yes", "Yes"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const educationTurn = agentTurns[agentTurns.length - 1];
    expect(educationTurn.content).toMatch(/paying it off first|costs more than ETF/i);
    expect(educationTurn.content).not.toMatch(/unexpected expense/i);
  });

  it("should send both education messages in a single turn when user has no EF and has debt", async () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(answerNo)
      .mockResolvedValueOnce(answerYes);
    const responder = createTrackedResponder(["No", "Yes"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const educationTurn = agentTurns[agentTurns.length - 1];
    expect(educationTurn.content).toMatch(/unexpected expense/i);
    expect(educationTurn.content).toMatch(/paying it off first|costs more than ETF/i);
  });

  it("should not call waitForResponse after sending education", async () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(answerNo)
      .mockResolvedValueOnce(answerNo);
    const responder = createTrackedResponder(["No", "No"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    expect(responder.transcript.filter((t) => t.role === "user")).toHaveLength(2);
  });

  it("should default to no EF and show EF education when EF askWithClassify exhausts follow-ups", async () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(needsClarification)
      .mockResolvedValueOnce(needsClarification)
      .mockResolvedValueOnce(needsClarification)
      .mockResolvedValueOnce(answerNo);
    const responder = createTrackedResponder(["r1", "r2", "r3", "No"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const lastMessage = agentTurns[agentTurns.length - 1].content;
    expect(lastMessage).toMatch(/unexpected expense/i);
    expect(lastMessage).not.toMatch(/paying it off first|costs more than ETF/i);
  });

  it("should default to has debt and show debt education when debt askWithClassify exhausts follow-ups", async () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(answerYes)
      .mockResolvedValueOnce(needsClarification)
      .mockResolvedValueOnce(needsClarification)
      .mockResolvedValueOnce(needsClarification);
    const responder = createTrackedResponder(["Yes", "r1", "r2", "r3"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const lastMessage = agentTurns[agentTurns.length - 1].content;
    expect(lastMessage).toMatch(/paying it off first|costs more than ETF/i);
    expect(lastMessage).not.toMatch(/unexpected expense/i);
  });

  // EF path covers ClassifyOutputInvalidError (null answer post-convergence triggers
  // resolved-schema validation failure). Phase stays non-blocking by design — defaults
  // to safe educational fallback regardless of which classify error fires.
  it("should default to no EF and show EF education when EF classify output is invalid", async () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(
        createParsedResponse<EmergencyFundClassify>({
          clarificationNeeded: false,
          clarificationMessage: null,
          answer: null,
        }),
      )
      .mockResolvedValueOnce(answerNo);
    const responder = createTrackedResponder(["unclear", "No"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const lastMessage = agentTurns[agentTurns.length - 1].content;
    expect(lastMessage).toMatch(/unexpected expense/i);
  });

  // Mid-loop clarificationNeeded=true with null clarificationMessage triggers
  // ClassifyMessageMissingError. Same safe fallback applies.
  it("should default to no EF and show EF education when EF classify message is missing", async () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(
        createParsedResponse<EmergencyFundClassify>({
          clarificationNeeded: true,
          clarificationMessage: null,
          answer: null,
        }),
      )
      .mockResolvedValueOnce(answerNo);
    const responder = createTrackedResponder(["unclear", "No"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const lastMessage = agentTurns[agentTurns.length - 1].content;
    expect(lastMessage).toMatch(/unexpected expense/i);
  });
});
