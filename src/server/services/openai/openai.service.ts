import { StatusCodes } from "http-status-codes";
import { APIConnectionError, APIError } from "openai";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseOutputItem,
  ResponseStatus,
  ResponseUsage,
} from "openai/resources/responses/responses";
import type { ZodError, ZodType } from "zod";

import { openaiClient } from "#clients/openai.client";
import { InternalError, SchemaValidationError, ServiceUnavailableError } from "#errors";
import { createLogger } from "#lib/logger";

const logger = createLogger("openaiService");

type OpenAIError = APIError | APIConnectionError;

export type OpenAIResponse<T> = {
  id: string;
  output: T;
  usage: ResponseUsage | undefined;
};

const RESPONSE_NOT_COMPLETED_ERROR_MESSAGE = "OpenAI response not completed";
const SCHEMA_VALIDATION_ERROR_MESSAGE = "OpenAI parsed output failed schema validation";
const REQUEST_FAILED_ERROR_MESSAGE = "OpenAI request failed";

const logUsage = (usage: ResponseUsage) => {
  logger.debug("OpenAI usage", {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  });
};

const toNotCompletedError = (
  id: string,
  status: Exclude<ResponseStatus, "completed"> | undefined,
): Error => {
  logger.warn(RESPONSE_NOT_COMPLETED_ERROR_MESSAGE, {
    responseId: id,
    status,
  });

  return new ServiceUnavailableError(RESPONSE_NOT_COMPLETED_ERROR_MESSAGE);
};

const toSchemaValidationError = (id: string, cause: ZodError): Error => {
  logger.warn(SCHEMA_VALIDATION_ERROR_MESSAGE, {
    responseId: id,
    issues: cause.issues,
  });

  return new SchemaValidationError(SCHEMA_VALIDATION_ERROR_MESSAGE, cause);
};

// Errors reaching this handler are post-retry — the SDK retries 408/409/429/5xx
// and connection errors via `maxRetries` on openai.client.ts.
const toApiError = (error: APIError): Error => {
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

  return isTemporary
    ? new ServiceUnavailableError(REQUEST_FAILED_ERROR_MESSAGE)
    : new InternalError(REQUEST_FAILED_ERROR_MESSAGE);
};

const mapOpenAIError = (error: OpenAIError): Error => {
  // APIConnectionError must be checked first — it extends APIError, so the
  // APIError branch would otherwise swallow it and misroute to toApiError.
  if (error instanceof APIConnectionError) {
    logger.error("OpenAI connection error", error);

    return new ServiceUnavailableError(REQUEST_FAILED_ERROR_MESSAGE);
  }

  return toApiError(error);
};

export const callOpenAI = async (
  params: ResponseCreateParamsNonStreaming,
): Promise<OpenAIResponse<ResponseOutputItem[]>> => {
  try {
    const { status, usage, id, output } = await openaiClient.responses.create(params);

    if (usage) logUsage(usage);
    if (status !== "completed") throw toNotCompletedError(id, status);

    return { id, output, usage };
  } catch (error) {
    if (error instanceof APIConnectionError || error instanceof APIError)
      throw mapOpenAIError(error);

    throw error;
  }
};

export const callOpenAIParsed = async <T>(
  params: ResponseCreateParamsNonStreaming,
  schema: ZodType<T>,
): Promise<OpenAIResponse<T>> => {
  try {
    const {
      status,
      usage,
      id,
      output_parsed: output,
    } = await openaiClient.responses.parse<ResponseCreateParamsNonStreaming, unknown>(
      params,
    );

    if (usage) logUsage(usage);
    if (status !== "completed") throw toNotCompletedError(id, status);

    const result = schema.safeParse(output);
    if (!result.success) throw toSchemaValidationError(id, result.error);

    return { id, output: result.data, usage };
  } catch (error) {
    if (error instanceof APIConnectionError || error instanceof APIError)
      throw mapOpenAIError(error);

    throw error;
  }
};
