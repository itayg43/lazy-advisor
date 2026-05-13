import { StatusCodes } from "http-status-codes";
import { APIConnectionError, APIError } from "openai";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseOutputItem,
  ResponseStatus,
  ResponseUsage,
} from "openai/resources/responses/responses";

import { openaiClient } from "#clients/openai.client";
import { InternalError, ServiceUnavailableError } from "#errors";
import { createLogger } from "#lib/logger";

const logger = createLogger("openaiService");

export type OpenAIResponse<T> = {
  id: string;
  output: T;
  usage: ResponseUsage | undefined;
};

const RESPONSE_NOT_COMPLETED_ERROR_MESSAGE = "OpenAI response not completed";
const MISSING_PARSED_OUTPUT_ERROR_MESSAGE = "OpenAI responded with missing parsed output";
const REQUEST_FAILED_ERROR_MESSAGE = "OpenAI request failed";

const logUsage = (usage: ResponseUsage) => {
  logger.debug("OpenAI usage", {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  });
};

const handleNotCompletedResponseStatus = (
  id: string,
  status: Exclude<ResponseStatus, "completed"> | undefined,
): never => {
  logger.warn(RESPONSE_NOT_COMPLETED_ERROR_MESSAGE, {
    responseId: id,
    status,
  });

  throw new ServiceUnavailableError(RESPONSE_NOT_COMPLETED_ERROR_MESSAGE);
};

// OpenAI SDK error taxonomy (both handled below):
// - APIError: HTTP response received with error status (has `status`). Bucketed by class —
//   subclasses include BadRequestError (400), AuthenticationError (401), RateLimitError (429),
//   InternalServerError (5xx), etc.
// - APIConnectionError: no HTTP response — network failure, DNS, timeout, TCP error.
//   Always a temporary failure by nature. **Extends APIError**, so catch sites must
//   check `instanceof APIConnectionError` BEFORE `instanceof APIError`.
//
// Errors reaching the handlers below are post-retry — the SDK retries 408/409/429/5xx
// and connection errors via `maxRetries` on openai.client.ts.
const handleAPIError = (error: APIError): never => {
  logger.error("OpenAI API error", error, {
    status: error.status,
    message: error.message,
  });

  // 5xx + 429: temporary upstream failure → service unavailable.
  // 4xx (non-429): our problem (bad key, missing model, malformed request) → internal.
  const isTemporary =
    error.status !== undefined &&
    (error.status >= StatusCodes.INTERNAL_SERVER_ERROR ||
      error.status === StatusCodes.TOO_MANY_REQUESTS);

  if (isTemporary) throw new ServiceUnavailableError(REQUEST_FAILED_ERROR_MESSAGE);

  throw new InternalError(REQUEST_FAILED_ERROR_MESSAGE);
};

const handleAPIConnectionError = (error: APIConnectionError): never => {
  logger.error("OpenAI connection error", error);

  throw new ServiceUnavailableError(REQUEST_FAILED_ERROR_MESSAGE);
};

export const callOpenAI = async (
  params: ResponseCreateParamsNonStreaming,
): Promise<OpenAIResponse<ResponseOutputItem[]>> => {
  try {
    const { status, usage, id, output } = await openaiClient.responses.create(params);

    if (usage) logUsage(usage);
    if (status !== "completed") handleNotCompletedResponseStatus(id, status);

    return { id, output, usage };
  } catch (error) {
    // APIConnectionError first — it extends APIError (see taxonomy comment above).
    if (error instanceof APIConnectionError) handleAPIConnectionError(error);
    if (error instanceof APIError) handleAPIError(error);

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
      output_parsed: output,
    } = await openaiClient.responses.parse<ResponseCreateParamsNonStreaming, T>(params);

    if (usage) logUsage(usage);
    if (status !== "completed") handleNotCompletedResponseStatus(id, status);
    if (!output) {
      logger.warn(MISSING_PARSED_OUTPUT_ERROR_MESSAGE, {
        responseId: id,
      });

      throw new InternalError(MISSING_PARSED_OUTPUT_ERROR_MESSAGE);
    }

    return { id, output, usage };
  } catch (error) {
    // APIConnectionError first — it extends APIError (see taxonomy comment above).
    if (error instanceof APIConnectionError) handleAPIConnectionError(error);
    if (error instanceof APIError) handleAPIError(error);

    throw error;
  }
};
