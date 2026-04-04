import { StatusCodes } from "http-status-codes";
import { APIError } from "openai";
import type {
  ParsedResponse,
  Response,
  ResponseCreateParamsNonStreaming,
  ResponseOutputItem,
  ResponseUsage,
} from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InternalError, ServiceUnavailableError } from "#errors";
import { KnowledgeLevel, RiskTolerance } from "#schemas/pipeline.schema";
import { callOpenAI, callOpenAIParsed } from "#services/openai/openai.service";
import type { UserProfile } from "#types/pipeline.types";

const { mockedCreate, mockedParse } = vi.hoisted(() => ({
  mockedCreate: vi.fn(),
  mockedParse: vi.fn(),
}));

vi.mock("#clients/openai.client", () => ({
  openaiClient: {
    responses: {
      create: mockedCreate,
      parse: mockedParse,
    },
  },
}));

vi.mock("#lib/with-retry", () => ({
  withRetry: vi.fn((fn: () => unknown) => fn()),
}));

describe("openaiService", () => {
  const mockTokenUsage: ResponseUsage = {
    input_tokens: 120,
    output_tokens: 45,
    total_tokens: 165,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens_details: { reasoning_tokens: 0 },
  };

  const mockParams: ResponseCreateParamsNonStreaming = {
    model: "gpt-4o",
    instructions: "You are a helpful investment advisor for beginner ETF investors.",
    input: "I want to start investing in ETFs with $500/month",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("callOpenAI", () => {
    const mockFunctionCallOutput: ResponseOutputItem = {
      type: "function_call",
      name: "ask_user",
      call_id: "call_etf_risk",
      arguments: '{"question":"What is your risk tolerance for ETF investments?"}',
    };

    const createMockResponse = (overrides: Partial<Response> = {}): Response =>
      ({
        id: "resp_clarify_001",
        status: "completed",
        output: [mockFunctionCallOutput],
        usage: mockTokenUsage,
        ...overrides,
      }) as Response;

    it("should pass params to responses.create and return id, output, and usage", async () => {
      const mockResponse = createMockResponse();
      mockedCreate.mockResolvedValue(mockResponse);

      const result = await callOpenAI(mockParams);

      expect(mockedCreate).toHaveBeenCalledWith(mockParams);
      expect(result).toStrictEqual({
        id: mockResponse.id,
        output: mockResponse.output,
        usage: mockTokenUsage,
      });
    });

    it("should throw ServiceUnavailableError when response status is not completed", async () => {
      const mockResponse = createMockResponse({ status: "failed" });
      mockedCreate.mockResolvedValue(mockResponse);

      await expect(callOpenAI(mockParams)).rejects.toThrow(ServiceUnavailableError);
    });

    it("should throw ServiceUnavailableError when OpenAI returns an API error", async () => {
      const apiError = new APIError(
        StatusCodes.SERVICE_UNAVAILABLE,
        undefined,
        "Service overloaded",
        undefined,
      );
      mockedCreate.mockRejectedValue(apiError);

      await expect(callOpenAI(mockParams)).rejects.toThrow(ServiceUnavailableError);
    });
  });

  describe("callOpenAIParsed", () => {
    const mockParsedOutput: UserProfile = {
      goal: "Build a diversified ETF portfolio for retirement",
      amount: 10000,
      age: 30,
      riskTolerance: RiskTolerance.enum.moderate,
      timeline: "10+ years",
      location: "United States",
      knowledgeLevel: KnowledgeLevel.enum.beginner,
      brokerage: "none",
      investmentPreferences: "none",
      hasEmergencyFund: true,
      hasDebt: false,
      monthlyContribution: 500,
    };

    const createMockParsedResponse = (
      overrides: Partial<ParsedResponse<UserProfile>> = {},
    ): ParsedResponse<UserProfile> =>
      ({
        id: "resp_extract_001",
        status: "completed",
        output: [],
        output_parsed: mockParsedOutput,
        usage: mockTokenUsage,
        ...overrides,
      }) as ParsedResponse<UserProfile>;

    it("should pass params to responses.parse and return id, parsed output, and usage", async () => {
      const mockResponse = createMockParsedResponse();
      mockedParse.mockResolvedValue(mockResponse);

      const result = await callOpenAIParsed<UserProfile>(mockParams);

      expect(mockedParse).toHaveBeenCalledWith(mockParams);
      expect(result).toStrictEqual({
        id: mockResponse.id,
        output: mockParsedOutput,
        usage: mockTokenUsage,
      });
    });

    it("should throw ServiceUnavailableError when response status is not completed", async () => {
      const mockResponse = createMockParsedResponse({ status: "failed" });
      mockedParse.mockResolvedValue(mockResponse);

      await expect(callOpenAIParsed<UserProfile>(mockParams)).rejects.toThrow(
        ServiceUnavailableError,
      );
    });

    it("should throw InternalError when output_parsed is null", async () => {
      const mockResponse = createMockParsedResponse({ output_parsed: null });
      mockedParse.mockResolvedValue(mockResponse);

      await expect(callOpenAIParsed<UserProfile>(mockParams)).rejects.toThrow(
        InternalError,
      );
    });

    it("should throw ServiceUnavailableError when OpenAI returns an API error", async () => {
      const apiError = new APIError(
        StatusCodes.TOO_MANY_REQUESTS,
        undefined,
        "Rate limit exceeded",
        undefined,
      );
      mockedParse.mockRejectedValue(apiError);

      await expect(callOpenAIParsed<UserProfile>(mockParams)).rejects.toThrow(
        ServiceUnavailableError,
      );
    });
  });
});
