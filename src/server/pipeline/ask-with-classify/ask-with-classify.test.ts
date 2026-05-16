import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { askWithClassify } from "#pipeline/ask-with-classify/ask-with-classify";
import {
  ClassifyFollowUpsExhaustedError,
  ClassifyMessageMissingError,
  ClassifyResolvedOutputInvalidError,
} from "#pipeline/ask-with-classify/ask-with-classify.errors";
import type { AskWithClassifyParams } from "#pipeline/ask-with-classify/ask-with-classify.types";
import { createTrackedResponder } from "#pipeline/eval.transcript";
import {
  AmountClassifyResolvedSchema,
  AmountClassifySchema,
} from "#pipeline/stages/clarify/parameters/clarify.parameters.schemas";
import type { AmountClassify } from "#pipeline/stages/clarify/parameters/clarify.parameters.types";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

type AmountResolved = z.infer<typeof AmountClassifyResolvedSchema>;
type AmountParams = AskWithClassifyParams<AmountClassify, AmountResolved>;

describe("askWithClassify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockQuestion = "How much do you plan to invest?";
  const mockClassifyInstructions = "Classify the user's amount answer.";
  const mockClarificationMessage = "Could you give me a specific amount in shekels?";
  const mockAmount = 30_000;
  const mockUserAmountResponse = `₪${mockAmount}`;
  const mockUnsureResponse = "I'm not sure";

  const createParsedResponse = <T>(output: T): OpenAIResponse<T> => ({
    id: "resp_test",
    usage: undefined,
    output,
  });

  const resolvedAmountResponse: OpenAIResponse<AmountClassify> = createParsedResponse({
    clarificationNeeded: false,
    clarificationMessage: null,
    amount: mockAmount,
  });

  const needsClarificationResponse: OpenAIResponse<AmountClassify> = createParsedResponse(
    {
      clarificationNeeded: true,
      clarificationMessage: mockClarificationMessage,
      amount: null,
    },
  );

  it("should send the question, pass [question, response] history to OpenAI, and return resolved output on first turn", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(resolvedAmountResponse);
    const responder = createTrackedResponder([mockUserAmountResponse]);
    const params: AmountParams = {
      question: mockQuestion,
      classifyInstructions: mockClassifyInstructions,
      schema: AmountClassifySchema,
      resolvedSchema: AmountClassifyResolvedSchema,
      responder,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 1,
    };

    const output = await askWithClassify(params);

    expect(output).toEqual({
      clarificationNeeded: false,
      clarificationMessage: null,
      amount: mockAmount,
    });
    expect(responder.transcript).toEqual([
      { role: "agent", content: mockQuestion },
      { role: "user", content: mockUserAmountResponse },
    ]);
    expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(1);
    expect(mockedCallOpenAIParsed.mock.calls[0]?.[0]).toMatchObject({
      instructions: mockClassifyInstructions,
      input: [
        { role: "assistant", content: mockQuestion },
        { role: "user", content: mockUserAmountResponse },
      ],
    });
  });

  it("should send the clarificationMessage, accumulate history, and return resolved output on the follow-up turn", async () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(needsClarificationResponse)
      .mockResolvedValueOnce(resolvedAmountResponse);
    const responder = createTrackedResponder([
      mockUnsureResponse,
      mockUserAmountResponse,
    ]);
    const params: AmountParams = {
      question: mockQuestion,
      classifyInstructions: mockClassifyInstructions,
      schema: AmountClassifySchema,
      resolvedSchema: AmountClassifyResolvedSchema,
      responder,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 1,
    };

    const output = await askWithClassify(params);

    expect(output.amount).toBe(mockAmount);
    expect(responder.transcript).toEqual([
      { role: "agent", content: mockQuestion },
      { role: "user", content: mockUnsureResponse },
      { role: "agent", content: mockClarificationMessage },
      { role: "user", content: mockUserAmountResponse },
    ]);
    expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(2);
    expect(mockedCallOpenAIParsed.mock.calls[1]?.[0]).toMatchObject({
      input: [
        { role: "assistant", content: mockQuestion },
        { role: "user", content: mockUnsureResponse },
        { role: "assistant", content: mockClarificationMessage },
        { role: "user", content: mockUserAmountResponse },
      ],
    });
  });

  it("should throw ClassifyFollowUpsExhaustedError when no attempt resolves within the follow-up budget", async () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(needsClarificationResponse)
      .mockResolvedValueOnce(needsClarificationResponse);
    const responder = createTrackedResponder([mockUnsureResponse, "still not sure"]);
    const params: AmountParams = {
      question: mockQuestion,
      classifyInstructions: mockClassifyInstructions,
      schema: AmountClassifySchema,
      resolvedSchema: AmountClassifyResolvedSchema,
      responder,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 1,
    };

    await expect(askWithClassify(params)).rejects.toBeInstanceOf(
      ClassifyFollowUpsExhaustedError,
    );
  });

  it("should throw ClassifyMessageMissingError when clarificationNeeded is true mid-loop but clarificationMessage is null", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<AmountClassify>({
        clarificationNeeded: true,
        clarificationMessage: null,
        amount: null,
      }),
    );
    const responder = createTrackedResponder([mockUnsureResponse]);
    const params: AmountParams = {
      question: mockQuestion,
      classifyInstructions: mockClassifyInstructions,
      schema: AmountClassifySchema,
      resolvedSchema: AmountClassifyResolvedSchema,
      responder,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 1,
    };

    await expect(askWithClassify(params)).rejects.toBeInstanceOf(
      ClassifyMessageMissingError,
    );
  });

  it("should throw ClassifyResolvedOutputInvalidError when clarificationNeeded is false but the resolvedSchema rejects the output", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<AmountClassify>({
        clarificationNeeded: false,
        clarificationMessage: null,
        amount: null,
      }),
    );
    const responder = createTrackedResponder(["something"]);
    const params: AmountParams = {
      question: mockQuestion,
      classifyInstructions: mockClassifyInstructions,
      schema: AmountClassifySchema,
      resolvedSchema: AmountClassifyResolvedSchema,
      responder,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 1,
    };

    await expect(askWithClassify(params)).rejects.toBeInstanceOf(
      ClassifyResolvedOutputInvalidError,
    );
  });
});
