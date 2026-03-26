import type { ResponseOutputItem } from "openai/resources/responses/responses";
import { describe, expect, it, vi } from "vitest";

import { InternalError } from "#server/errors";
import type { OpenAIResponse } from "#server/services/openai";
import { MAX_STAGE_TOOL_CALLS } from "#shared/constants/constants";
import { runClarifyStage } from "./clarify.stage";

const { mockedCallOpenAI } = vi.hoisted(() => ({
  mockedCallOpenAI: vi.fn(),
}));

vi.mock("#server/services/openai", () => ({
  callOpenAI: mockedCallOpenAI,
  callOpenAIParsed: vi.fn(),
}));

describe("clarifyStage", () => {
  const mockGoal = "I have $15k and want to start investing";
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
        arguments: JSON.stringify({ question: "What is your age?" }),
      },
    ],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
    },
  });

  it("throws InternalError when tool call cap is reached", async () => {
    mockWaitForResponse.mockResolvedValue("some vague answer");

    let callCount = 0;
    mockedCallOpenAI.mockImplementation(() => {
      callCount++;
      return Promise.resolve(createAskUserResponse(`call_${String(callCount)}`));
    });

    await expect(
      runClarifyStage(mockGoal, mockSendToUser, mockWaitForResponse),
    ).rejects.toThrow(InternalError);

    expect(mockWaitForResponse).toHaveBeenCalledTimes(MAX_STAGE_TOOL_CALLS);
  });
});
