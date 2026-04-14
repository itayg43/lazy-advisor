import type {
  ResponseOutputItem,
  ResponseUsage,
} from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InternalError } from "#errors";
import { MAX_FIELDS_TOOL_CALLS } from "#pipeline/stages/clarify/clarify.constants";
import { collectFields } from "#pipeline/stages/clarify/fields/clarify.fields";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAI } = vi.hoisted(() => ({
  mockedCallOpenAI: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAI: mockedCallOpenAI,
}));

describe("collectFields", () => {
  const mockTokenUsage: ResponseUsage = {
    input_tokens: 120,
    output_tokens: 45,
    total_tokens: 165,
    input_tokens_details: {
      cached_tokens: 0,
    },
    output_tokens_details: {
      reasoning_tokens: 0,
    },
  };

  const mockGoal = "I have ₪55,000 and want to start investing in ETFs";
  const mockSendToUser = vi.fn();
  const mockWaitForResponse = vi.fn<() => Promise<string>>();

  const createAskUserResponse = (
    callId: string,
  ): OpenAIResponse<ResponseOutputItem[]> => ({
    id: `resp_${callId}`,
    output: [
      {
        type: "function_call",
        id: `fc_${callId}`,
        call_id: callId,
        name: "ask_user",
        arguments: JSON.stringify({
          question: "How old are you, and what is your investment timeline?",
        }),
      },
    ],
    usage: mockTokenUsage,
  });

  const createTextResponse = (): OpenAIResponse<ResponseOutputItem[]> => ({
    id: "resp_fields_done",
    output: [
      {
        type: "message",
        id: "msg_fields_done",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: "Got it, I have all the details I need.",
            annotations: [],
          },
        ],
      },
    ],
    usage: mockTokenUsage,
  });

  const createUnexpectedToolResponse = (): OpenAIResponse<ResponseOutputItem[]> => ({
    id: "resp_unexpected_tool",
    output: [
      {
        type: "function_call",
        id: "fc_unexpected_tool",
        call_id: "call_unexpected_tool",
        name: "search_web",
        arguments: JSON.stringify({
          query: "best ETFs 2026",
        }),
      },
    ],
    usage: mockTokenUsage,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return response ID when model needs no clarification", async () => {
    mockedCallOpenAI.mockResolvedValue(createTextResponse());

    const result = await collectFields(
      { input: mockGoal },
      mockSendToUser,
      mockWaitForResponse,
    );

    expect(result).toBe("resp_fields_done");
    expect(mockWaitForResponse).not.toHaveBeenCalled();
    expect(mockedCallOpenAI).toHaveBeenCalledTimes(1);
  });

  it("should ask user for clarification then return response ID", async () => {
    const mockUserResponse = "I'm 28, moderate risk, 20 years, beginner";
    mockWaitForResponse.mockResolvedValue(mockUserResponse);

    mockedCallOpenAI
      .mockResolvedValueOnce(createAskUserResponse("fields_1"))
      .mockResolvedValueOnce(createTextResponse());

    const result = await collectFields(
      { input: mockGoal },
      mockSendToUser,
      mockWaitForResponse,
    );

    expect(result).toBe("resp_fields_done");
    expect(mockSendToUser).toHaveBeenCalledTimes(1);
    expect(mockWaitForResponse).toHaveBeenCalledTimes(1);
    expect(mockedCallOpenAI).toHaveBeenCalledTimes(2);
  });

  it("should throw InternalError for unexpected tool name", async () => {
    mockedCallOpenAI.mockResolvedValue(createUnexpectedToolResponse());

    await expect(
      collectFields({ input: mockGoal }, mockSendToUser, mockWaitForResponse),
    ).rejects.toThrow(InternalError);
  });

  it("should throw InternalError when tool call cap is reached", async () => {
    mockWaitForResponse.mockResolvedValue("I'm not sure, maybe moderate risk");

    let callCount = 0;
    mockedCallOpenAI.mockImplementation(() => {
      callCount++;

      return Promise.resolve(createAskUserResponse(`call_${callCount}`));
    });

    await expect(
      collectFields({ input: mockGoal }, mockSendToUser, mockWaitForResponse),
    ).rejects.toThrow(InternalError);

    expect(mockWaitForResponse).toHaveBeenCalledTimes(MAX_FIELDS_TOOL_CALLS);
  });
});
