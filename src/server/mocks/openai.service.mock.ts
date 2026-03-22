import type {
  ResponseOutputItem,
  ResponseUsage,
} from "openai/resources/responses/responses";
import { vi } from "vitest";

import type { OpenAIResponse } from "#server/services/openai";

export const { mockedCallOpenAI, mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAI: vi.fn(),
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#server/services/openai", () => ({
  callOpenAI: mockedCallOpenAI,
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

export const mockTokenUsage: ResponseUsage = {
  input_tokens: 120,
  output_tokens: 45,
  total_tokens: 165,
  input_tokens_details: { cached_tokens: 0 },
  output_tokens_details: { reasoning_tokens: 0 },
};

export const createToolCallResponseMock = (
  output: ResponseOutputItem[],
): OpenAIResponse<ResponseOutputItem[]> => ({
  id: "resp_mock_001",
  output,
  usage: mockTokenUsage,
});

export const createParsedResponseMock = <T>(output: T): OpenAIResponse<T> => ({
  id: "resp_mock_001",
  output,
  usage: mockTokenUsage,
});
