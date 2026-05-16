import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { askWithClassify } from "#pipeline/ask-with-classify/ask-with-classify";
import {
  ClassifyFollowUpsExhaustedError,
  ClassifyMessageMissingError,
  ClassifyResolvedOutputInvalidError,
} from "#pipeline/ask-with-classify/ask-with-classify.errors";
import { AskWithClassifyBaseSchema } from "#pipeline/ask-with-classify/ask-with-classify.schemas";
import type { AskWithClassifyParams } from "#pipeline/ask-with-classify/ask-with-classify.types";
import { createTrackedResponder } from "#pipeline/eval.transcript";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

// askWithClassify is generic over <TOutput, TResolved>, so the test schemas are
// synthetic by necessity — using a consumer's domain schemas would re-introduce
// the reverse coupling the module extraction was meant to remove.
const TestClassifySchema = AskWithClassifyBaseSchema.extend({
  value: z.number().nullable(),
});
const TestClassifyResolvedSchema = TestClassifySchema.extend({
  value: z.number(),
});
type TestClassify = z.infer<typeof TestClassifySchema>;
type TestResolved = z.infer<typeof TestClassifyResolvedSchema>;
type TestParams = AskWithClassifyParams<TestClassify, TestResolved>;

describe("askWithClassify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockQuestion = "How much do you plan to invest?";
  const mockClassifyInstructions = "Classify the user's amount answer.";
  const mockClarificationMessage = "Could you give me a specific amount in shekels?";
  const mockValue = 30_000;
  const mockUserResponse = `₪${mockValue}`;
  const mockUnsureResponse = "I'm not sure";

  const createParsedResponse = <T>(output: T): OpenAIResponse<T> => ({
    id: "resp_test",
    usage: undefined,
    output,
  });

  const resolvedResponse: OpenAIResponse<TestClassify> = createParsedResponse({
    clarificationNeeded: false,
    clarificationMessage: null,
    value: mockValue,
  });

  const needsClarificationResponse: OpenAIResponse<TestClassify> = createParsedResponse({
    clarificationNeeded: true,
    clarificationMessage: mockClarificationMessage,
    value: null,
  });

  it("should send the question, pass [question, response] history to OpenAI, and return resolved output on first turn", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(resolvedResponse);
    const responder = createTrackedResponder([mockUserResponse]);
    const params: TestParams = {
      question: mockQuestion,
      classifyInstructions: mockClassifyInstructions,
      schema: TestClassifySchema,
      resolvedSchema: TestClassifyResolvedSchema,
      responder,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 1,
    };

    const output = await askWithClassify(params);

    expect(output).toEqual({
      clarificationNeeded: false,
      clarificationMessage: null,
      value: mockValue,
    });
    expect(responder.transcript).toEqual([
      { role: "agent", content: mockQuestion },
      { role: "user", content: mockUserResponse },
    ]);
    expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(1);
    expect(mockedCallOpenAIParsed.mock.calls[0]?.[0]).toMatchObject({
      instructions: mockClassifyInstructions,
      input: [
        { role: "assistant", content: mockQuestion },
        { role: "user", content: mockUserResponse },
      ],
    });
  });

  it("should send the clarificationMessage, accumulate history, and return resolved output on the follow-up turn", async () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(needsClarificationResponse)
      .mockResolvedValueOnce(resolvedResponse);
    const responder = createTrackedResponder([mockUnsureResponse, mockUserResponse]);
    const params: TestParams = {
      question: mockQuestion,
      classifyInstructions: mockClassifyInstructions,
      schema: TestClassifySchema,
      resolvedSchema: TestClassifyResolvedSchema,
      responder,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 1,
    };

    const output = await askWithClassify(params);

    expect(output.value).toBe(mockValue);
    expect(responder.transcript).toEqual([
      { role: "agent", content: mockQuestion },
      { role: "user", content: mockUnsureResponse },
      { role: "agent", content: mockClarificationMessage },
      { role: "user", content: mockUserResponse },
    ]);
    expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(2);
    expect(mockedCallOpenAIParsed.mock.calls[1]?.[0]).toMatchObject({
      input: [
        { role: "assistant", content: mockQuestion },
        { role: "user", content: mockUnsureResponse },
        { role: "assistant", content: mockClarificationMessage },
        { role: "user", content: mockUserResponse },
      ],
    });
  });

  it("should throw ClassifyFollowUpsExhaustedError when no attempt resolves within the follow-up budget", async () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(needsClarificationResponse)
      .mockResolvedValueOnce(needsClarificationResponse);
    const responder = createTrackedResponder([mockUnsureResponse, "still not sure"]);
    const params: TestParams = {
      question: mockQuestion,
      classifyInstructions: mockClassifyInstructions,
      schema: TestClassifySchema,
      resolvedSchema: TestClassifyResolvedSchema,
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
      createParsedResponse<TestClassify>({
        clarificationNeeded: true,
        clarificationMessage: null,
        value: null,
      }),
    );
    const responder = createTrackedResponder([mockUnsureResponse]);
    const params: TestParams = {
      question: mockQuestion,
      classifyInstructions: mockClassifyInstructions,
      schema: TestClassifySchema,
      resolvedSchema: TestClassifyResolvedSchema,
      responder,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 1,
    };

    await expect(askWithClassify(params)).rejects.toBeInstanceOf(
      ClassifyMessageMissingError,
    );
  });

  // Ordering invariant: on the final attempt, exhaustion is checked before the
  // missing-message check, so clarificationNeeded=true + clarificationMessage=null
  // surfaces as exhausted (user-driven), not as the model-bug error.
  it("should throw ClassifyFollowUpsExhaustedError (not ClassifyMessageMissingError) when the final attempt returns clarificationNeeded=true with null clarificationMessage", async () => {
    const finalAttemptNeedsClarificationNoMessage: OpenAIResponse<TestClassify> =
      createParsedResponse({
        clarificationNeeded: true,
        clarificationMessage: null,
        value: null,
      });
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(needsClarificationResponse)
      .mockResolvedValueOnce(finalAttemptNeedsClarificationNoMessage);
    const responder = createTrackedResponder([mockUnsureResponse, "still unclear"]);
    const params: TestParams = {
      question: mockQuestion,
      classifyInstructions: mockClassifyInstructions,
      schema: TestClassifySchema,
      resolvedSchema: TestClassifyResolvedSchema,
      responder,
      model: "gpt-5.4-nano",
      effort: "low",
      followUps: 1,
    };

    await expect(askWithClassify(params)).rejects.toBeInstanceOf(
      ClassifyFollowUpsExhaustedError,
    );
  });

  it("should throw ClassifyResolvedOutputInvalidError when clarificationNeeded is false but the resolvedSchema rejects the output", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<TestClassify>({
        clarificationNeeded: false,
        clarificationMessage: null,
        value: null,
      }),
    );
    const responder = createTrackedResponder(["something"]);
    const params: TestParams = {
      question: mockQuestion,
      classifyInstructions: mockClassifyInstructions,
      schema: TestClassifySchema,
      resolvedSchema: TestClassifyResolvedSchema,
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
