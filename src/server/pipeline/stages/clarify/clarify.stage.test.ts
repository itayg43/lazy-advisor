import type {
  ResponseOutputItem,
  ResponseUsage,
} from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InternalError } from "#server/errors";
import { KnowledgeLevel, RiskTolerance } from "#server/schemas/pipeline.schema";
import type { OpenAIResponse } from "#server/services/openai";
import type { UserProfile } from "#server/types/pipeline.types";
import { MAX_STAGE_TOOL_CALLS } from "#shared/constants/constants";
import { runClarifyStage } from "./clarify.stage";

const { mockedCallOpenAI, mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAI: vi.fn(),
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#server/services/openai", () => ({
  callOpenAI: mockedCallOpenAI,
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("clarifyStage", () => {
  const mockGoal = "I have ₪55,000 and want to start investing in ETFs";
  const mockSendToUser = vi.fn();
  const mockWaitForResponse = vi.fn<() => Promise<string>>();

  const mockUsage: ResponseUsage = {
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

  const mockProfile: UserProfile = {
    goal: "invest ₪55,000 in ETFs as a beginner",
    amount: 55_000,
    age: 28,
    riskTolerance: RiskTolerance.enum.moderate,
    timeline: "20 years",
    location: "Israel",
    knowledgeLevel: KnowledgeLevel.enum.beginner,
    brokerage: "none",
    hasEmergencyFund: true,
    hasDebt: false,
    monthlyContribution: 1_800,
  };

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
          question: "What is your risk tolerance for ETF investments?",
        }),
      },
    ],
    usage: mockUsage,
  });

  const createTextResponse = (): OpenAIResponse<ResponseOutputItem[]> => ({
    id: "resp_clarify_done",
    output: [
      {
        type: "message",
        id: "msg_clarify_done",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: "Got it, I have everything I need to build your plan.",
            annotations: [],
          },
        ],
      },
    ],
    usage: mockUsage,
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
    usage: mockUsage,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns extracted profile when model needs no clarification", async () => {
    mockedCallOpenAI.mockResolvedValue(createTextResponse());
    mockedCallOpenAIParsed.mockResolvedValue({
      output: mockProfile,
    });

    const result = await runClarifyStage(mockGoal, mockSendToUser, mockWaitForResponse);

    expect(result).toEqual(mockProfile);
    expect(mockWaitForResponse).not.toHaveBeenCalled();
    expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(1);
  });

  it("asks user for clarification then returns extracted profile", async () => {
    const mockUserResponse = "I'm 28, moderate risk, based in Israel";
    mockWaitForResponse.mockResolvedValue(mockUserResponse);

    mockedCallOpenAI
      .mockResolvedValueOnce(createAskUserResponse("clarify_1"))
      .mockResolvedValueOnce(createTextResponse());
    mockedCallOpenAIParsed.mockResolvedValue({
      output: mockProfile,
    });

    const result = await runClarifyStage(mockGoal, mockSendToUser, mockWaitForResponse);

    expect(result).toEqual(mockProfile);
    expect(mockSendToUser).toHaveBeenCalledTimes(1);
    expect(mockWaitForResponse).toHaveBeenCalledTimes(1);
    expect(mockedCallOpenAI).toHaveBeenCalledTimes(2);
    expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(1);
  });

  it("throws InternalError for unexpected tool name", async () => {
    mockedCallOpenAI.mockResolvedValue(createUnexpectedToolResponse());

    await expect(
      runClarifyStage(mockGoal, mockSendToUser, mockWaitForResponse),
    ).rejects.toThrow(InternalError);
  });

  it("throws InternalError when tool call cap is reached", async () => {
    mockWaitForResponse.mockResolvedValue("I'm not sure, maybe moderate risk");

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
