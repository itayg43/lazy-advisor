import { StatusCodes } from "http-status-codes";
import { APIConnectionError, APIError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type {
  ResponseCreateParamsNonStreaming,
  ResponseOutputItem,
  ResponseStatus,
  ResponseUsage,
} from "openai/resources/responses/responses";
import type { ZodError, ZodType } from "zod";

import { openaiClient } from "#clients/openai.client";
import {
  BadGatewaySchemaValidationError,
  InternalError,
  ServiceUnavailableError,
} from "#errors";
import { createLogger } from "#lib/logger";
import { parseSchema } from "#lib/parse-schema";

const logger = createLogger("openaiService");

type OpenAIError = APIError | APIConnectionError;

const isOpenAIError = (error: unknown): error is OpenAIError =>
  error instanceof APIConnectionError || error instanceof APIError;

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

const toSchemaValidationError = (
  id: string,
  cause: ZodError,
  value: unknown,
): BadGatewaySchemaValidationError => {
  logger.warn(SCHEMA_VALIDATION_ERROR_MESSAGE, {
    responseId: id,
    issues: cause.issues,
    value,
  });

  return new BadGatewaySchemaValidationError(
    SCHEMA_VALIDATION_ERROR_MESSAGE,
    cause,
    value,
  );
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
    if (isOpenAIError(error)) throw mapOpenAIError(error);

    throw error;
  }
};

// `text` is owned here, not by callers: we derive the structured-output format
// from the same `schema` we validate against, so the two can never drift. Callers
// pass everything except `text`.
//
// The schema name passed to zodTextFormat is hardcoded to "output". It's a
// required-but-cosmetic label on the response_format — the model is constrained by
// the schema itself, not its name, and any semantic hint to the model belongs in
// the schema's field descriptions. A single constant keeps call sites clean; revisit
// only if a per-schema name turns out to matter (e.g. for response-log readability).
export const callOpenAIParsed = async <T>(
  params: Omit<ResponseCreateParamsNonStreaming, "text">,
  schema: ZodType<T>,
): Promise<OpenAIResponse<T>> => {
  try {
    const {
      status,
      usage,
      id,
      output_parsed: rawOutput,
    } = await openaiClient.responses.parse<ResponseCreateParamsNonStreaming, unknown>({
      ...params,
      text: { format: zodTextFormat(schema, "output") },
    });

    if (usage) logUsage(usage);
    if (status !== "completed") throw toNotCompletedError(id, status);

    const output = parseSchema(schema, rawOutput, (error, value) =>
      toSchemaValidationError(id, error, value),
    );

    return { id, output, usage };
  } catch (error) {
    if (isOpenAIError(error)) throw mapOpenAIError(error);

    throw error;
  }
};
