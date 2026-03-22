import { APIError } from "openai";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseOutputItem,
  ResponseStatus,
  ResponseUsage,
} from "openai/resources/responses/responses";

import { openaiClient } from "#server/clients/openai.client";
import { InternalError, ServiceUnavailableError } from "#server/errors";
import { withRetry } from "#server/lib/with-retry";

export type OpenAIResponse<T> = {
  id: string;
  output: T;
  usage: ResponseUsage | undefined;
};

const logTokenUsage = (operation: string, usage: ResponseUsage | undefined): void => {
  if (!usage) return;

  // TODO: replace with structured logger (Section 10)
  console.log(
    `[${operation}] Tokens — input: ${String(usage.input_tokens)}, output: ${String(usage.output_tokens)}, total: ${String(usage.total_tokens)}`,
  );
};

const validateResponseStatus = (status: ResponseStatus | undefined): void => {
  if (status !== "completed") {
    throw new ServiceUnavailableError(
      `OpenAI response not completed: status=${String(status)}`,
    );
  }
};

export const callOpenAI = async (
  params: ResponseCreateParamsNonStreaming,
): Promise<OpenAIResponse<ResponseOutputItem[]>> => {
  try {
    const { status, usage, id, output } = await withRetry(
      () => openaiClient.responses.create(params),
      { operation: "callOpenAI" },
    );

    logTokenUsage("callOpenAI", usage);
    validateResponseStatus(status);

    return {
      id,
      output,
      usage,
    };
  } catch (error) {
    if (error instanceof APIError) {
      throw new ServiceUnavailableError(`OpenAI API error: ${error.message}`);
    }

    throw error;
  }
};

export const callOpenAIParsed = async <T>(
  params: ResponseCreateParamsNonStreaming,
): Promise<OpenAIResponse<T>> => {
  try {
    const {
      status,
      usage,
      id,
      output_parsed: outputParsed,
    } = await withRetry(
      () => openaiClient.responses.parse<ResponseCreateParamsNonStreaming, T>(params),
      { operation: "callOpenAIParsed" },
    );

    logTokenUsage("callOpenAIParsed", usage);
    validateResponseStatus(status);

    if (!outputParsed) {
      throw new InternalError("OpenAI responded with missing parsed output");
    }

    return {
      id,
      output: outputParsed,
      usage,
    };
  } catch (error) {
    if (error instanceof APIError) {
      throw new ServiceUnavailableError(`OpenAI API error: ${error.message}`);
    }

    throw error;
  }
};
