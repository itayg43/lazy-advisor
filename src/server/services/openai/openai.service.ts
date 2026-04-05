import { APIError } from "openai";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseOutputItem,
  ResponseStatus,
  ResponseUsage,
} from "openai/resources/responses/responses";

import { openaiClient } from "#clients/openai.client";
import { InternalError, ServiceUnavailableError } from "#errors";
import { createLogger } from "#lib/logger";
import { withRetry } from "#lib/with-retry";

const logger = createLogger("openaiService");

export type OpenAIResponse<T> = {
  id: string;
  output: T;
  usage: ResponseUsage | undefined;
};

const OPENAI_REQUEST_FAILED_MESSAGE = "OpenAI request failed";

const logTokenUsage = (operation: string, usage: ResponseUsage | undefined): void => {
  if (!usage) return;

  logger.info(`${operation} token usage`, {
    operation,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
  });
};

const validateResponseStatus = (status: ResponseStatus | undefined): void => {
  if (status !== "completed") {
    throw new ServiceUnavailableError(`OpenAI response not completed: status=${status}`);
  }
};

const handleOpenAIError = (error: unknown): never => {
  if (error instanceof APIError) {
    logger.error("OpenAI API error", { status: error.status, message: error.message });

    throw new ServiceUnavailableError(OPENAI_REQUEST_FAILED_MESSAGE);
  }

  throw error;
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

    return { id, output, usage };
  } catch (error) {
    return handleOpenAIError(error);
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

    return { id, output: outputParsed, usage };
  } catch (error) {
    return handleOpenAIError(error);
  }
};
