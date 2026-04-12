import type {
  ResponseOutputItem,
  ResponseUsage,
} from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InternalError } from "#errors";
import { MAX_PREFERENCES_TOOL_CALLS } from "#pipeline/stages/clarify/clarify.constants";
import { collectPreferences } from "#pipeline/stages/clarify/preferences/clarify.preferences";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAI } = vi.hoisted(() => ({
  mockedCallOpenAI: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAI: mockedCallOpenAI,
}));

describe("collectPreferences", () => {
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

  const mockFieldsResponseId = "resp_fields_123";
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
          question:
            "What do you want your equity allocation to look like, and are you comfortable with a קרן כספית buffer?",
        }),
      },
    ],
    usage: mockTokenUsage,
  });

  const createTextResponse = (): OpenAIResponse<ResponseOutputItem[]> => ({
    id: "resp_prefs_done",
    output: [
      {
        type: "message",
        id: "msg_prefs_done",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: "Got it, I have everything I need.",
            annotations: [],
          },
        ],
      },
    ],
    usage: mockTokenUsage,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return response ID immediately when no tool calls needed", async () => {
    mockedCallOpenAI.mockResolvedValue(createTextResponse());

    const result = await collectPreferences(
      mockFieldsResponseId,
      mockSendToUser,
      mockWaitForResponse,
    );

    expect(result).toBe("resp_prefs_done");
    expect(mockWaitForResponse).not.toHaveBeenCalled();
    expect(mockedCallOpenAI).toHaveBeenCalledTimes(1);
  });

  it("should call OpenAI with previous_response_id from fields phase", async () => {
    mockWaitForResponse.mockResolvedValue(
      "70% FTSE All-World and 30% TLV-125. קרן כספית is fine.",
    );

    mockedCallOpenAI
      .mockResolvedValueOnce(createAskUserResponse("prefs_1"))
      .mockResolvedValueOnce(createTextResponse());

    const result = await collectPreferences(
      mockFieldsResponseId,
      mockSendToUser,
      mockWaitForResponse,
    );

    expect(result).toBe("resp_prefs_done");
    expect(mockedCallOpenAI).toHaveBeenCalledTimes(2);
    expect(mockedCallOpenAI).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        previous_response_id: mockFieldsResponseId,
        input: [],
      }),
    );
  });

  it("should ask for split after portfolio defaults when user names multiple instruments without split", async () => {
    mockWaitForResponse
      .mockResolvedValueOnce("FTSE All-World and TLV-125. קרן כספית sounds good.")
      .mockResolvedValueOnce("70% FTSE All-World and 30% TLV-125.");

    mockedCallOpenAI
      .mockResolvedValueOnce(createAskUserResponse("prefs_1"))
      .mockResolvedValueOnce(createAskUserResponse("prefs_2"))
      .mockResolvedValueOnce(createTextResponse());

    const result = await collectPreferences(
      mockFieldsResponseId,
      mockSendToUser,
      mockWaitForResponse,
    );

    expect(result).toBe("resp_prefs_done");
    expect(mockedCallOpenAI).toHaveBeenCalledTimes(3);
    expect(mockWaitForResponse).toHaveBeenCalledTimes(2);
  });

  it("should throw InternalError for unexpected tool name", async () => {
    mockedCallOpenAI.mockResolvedValue({
      id: "resp_unexpected_tool",
      output: [
        {
          type: "function_call",
          id: "fc_unexpected_tool",
          call_id: "call_unexpected_tool",
          name: "search_web",
          arguments: JSON.stringify({ query: "best ETFs 2026" }),
        },
      ],
      usage: mockTokenUsage,
    });

    await expect(
      collectPreferences(mockFieldsResponseId, mockSendToUser, mockWaitForResponse),
    ).rejects.toThrow(InternalError);
  });

  it("should throw InternalError when tool call cap is reached", async () => {
    mockWaitForResponse.mockResolvedValue("I'm not sure");

    let callCount = 0;
    mockedCallOpenAI.mockImplementation(() => {
      callCount++;

      return Promise.resolve(createAskUserResponse(`call_${callCount}`));
    });

    await expect(
      collectPreferences(mockFieldsResponseId, mockSendToUser, mockWaitForResponse),
    ).rejects.toThrow(InternalError);

    expect(mockWaitForResponse).toHaveBeenCalledTimes(MAX_PREFERENCES_TOOL_CALLS);
  });
});
