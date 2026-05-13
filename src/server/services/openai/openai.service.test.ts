import { StatusCodes } from "http-status-codes";
import { APIConnectionError, APIError } from "openai";
import type {
  ParsedResponse,
  Response,
  ResponseCreateParamsNonStreaming,
  ResponseOutputItem,
  ResponseUsage,
} from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InternalError, ServiceUnavailableError } from "#errors";
import { RiskToleranceEnum, TimelineBucketEnum } from "#schemas/pipeline.schemas";
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

  const mockConnectionErrorMessage = "Connection refused";
  const mockAuthErrorMessage = "Invalid API key";
  const mockGenericErrorMessage = "network exploded";

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

    it.each([
      {
        label: "5xx",
        status: StatusCodes.SERVICE_UNAVAILABLE,
        message: "Service overloaded",
        expectedError: ServiceUnavailableError,
      },
      {
        label: "4xx",
        status: StatusCodes.UNAUTHORIZED,
        message: mockAuthErrorMessage,
        expectedError: InternalError,
      },
    ])(
      "should throw $expectedError.name when OpenAI returns a $label APIError",
      async ({ status, message, expectedError }) => {
        const apiError = new APIError(status, undefined, message, undefined);
        mockedCreate.mockRejectedValue(apiError);

        await expect(callOpenAI(mockParams)).rejects.toThrow(expectedError);
      },
    );

    it("should throw ServiceUnavailableError when OpenAI throws APIConnectionError", async () => {
      const connectionError = new APIConnectionError({
        message: mockConnectionErrorMessage,
      });
      mockedCreate.mockRejectedValue(connectionError);

      await expect(callOpenAI(mockParams)).rejects.toThrow(ServiceUnavailableError);
    });

    it("should rethrow non-APIError exceptions unchanged", async () => {
      const genericError = new Error(mockGenericErrorMessage);
      mockedCreate.mockRejectedValue(genericError);

      await expect(callOpenAI(mockParams)).rejects.toBe(genericError);
    });
  });

  describe("callOpenAIParsed", () => {
    const mockParsedOutput: UserProfile = {
      amount: 10000,
      timeline: TimelineBucketEnum.enum["10+ years"],
      riskTolerance: RiskToleranceEnum.enum.moderate,
      equityPercentage: 60,
      bufferPercentage: 40,
      plansToContribute: true,
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

    it.each([
      {
        label: "429",
        status: StatusCodes.TOO_MANY_REQUESTS,
        message: "Rate limit exceeded",
        expectedError: ServiceUnavailableError,
      },
      {
        label: "4xx",
        status: StatusCodes.UNAUTHORIZED,
        message: mockAuthErrorMessage,
        expectedError: InternalError,
      },
    ])(
      "should throw $expectedError.name when OpenAI returns a $label APIError",
      async ({ status, message, expectedError }) => {
        const apiError = new APIError(status, undefined, message, undefined);
        mockedParse.mockRejectedValue(apiError);

        await expect(callOpenAIParsed<UserProfile>(mockParams)).rejects.toThrow(
          expectedError,
        );
      },
    );

    it("should throw ServiceUnavailableError when OpenAI throws APIConnectionError", async () => {
      const connectionError = new APIConnectionError({
        message: mockConnectionErrorMessage,
      });
      mockedParse.mockRejectedValue(connectionError);

      await expect(callOpenAIParsed<UserProfile>(mockParams)).rejects.toThrow(
        ServiceUnavailableError,
      );
    });

    it("should rethrow non-APIError exceptions unchanged", async () => {
      const genericError = new Error(mockGenericErrorMessage);
      mockedParse.mockRejectedValue(genericError);

      await expect(callOpenAIParsed<UserProfile>(mockParams)).rejects.toBe(genericError);
    });
  });
});
