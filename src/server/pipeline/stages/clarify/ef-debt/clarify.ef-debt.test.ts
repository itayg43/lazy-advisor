import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackedResponder } from "#pipeline/eval.transcript";
import { collectEfDebt } from "#pipeline/stages/clarify/ef-debt/clarify.ef-debt";
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

  const efYes = createParsedResponse({
    clarificationNeeded: false,
    clarificationMessage: null,
    answer: "yes",
  });
  const efNo = createParsedResponse({
    clarificationNeeded: false,
    clarificationMessage: null,
    answer: "no",
  });
  const debtYes = createParsedResponse({
    clarificationNeeded: false,
    clarificationMessage: null,
    answer: "yes",
  });
  const debtNo = createParsedResponse({
    clarificationNeeded: false,
    clarificationMessage: null,
    answer: "no",
  });

  it("should end silently when user has EF and no debt", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(efYes).mockResolvedValueOnce(debtNo);
    const responder = createTrackedResponder(["Yes", "No"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns).toHaveLength(2);
  });

  it("should send EF education only when user has no emergency fund and no debt", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(efNo).mockResolvedValueOnce(debtNo);
    const responder = createTrackedResponder(["No", "No"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const educationTurn = agentTurns[agentTurns.length - 1];
    expect(educationTurn.content).toMatch(/unexpected expense/i);
    expect(educationTurn.content).not.toMatch(/paying it off first|costs more than ETF/i);
  });

  it("should send debt education only when user has EF and high-interest debt", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(efYes).mockResolvedValueOnce(debtYes);
    const responder = createTrackedResponder(["Yes", "Yes"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const educationTurn = agentTurns[agentTurns.length - 1];
    expect(educationTurn.content).toMatch(/paying it off first|costs more than ETF/i);
    expect(educationTurn.content).not.toMatch(/unexpected expense/i);
  });

  it("should send both education messages in a single turn when user has no EF and has debt", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(efNo).mockResolvedValueOnce(debtYes);
    const responder = createTrackedResponder(["No", "Yes"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    const educationTurn = agentTurns[agentTurns.length - 1];
    expect(educationTurn.content).toMatch(/unexpected expense/i);
    expect(educationTurn.content).toMatch(/paying it off first|costs more than ETF/i);
  });

  it("should not call waitForResponse after sending education", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(efNo).mockResolvedValueOnce(debtNo);
    const responder = createTrackedResponder(["No", "No"]);

    await collectEfDebt(responder.sendToUser, responder.waitForResponse);

    expect(responder.transcript.filter((t) => t.role === "user")).toHaveLength(2);
  });
});
