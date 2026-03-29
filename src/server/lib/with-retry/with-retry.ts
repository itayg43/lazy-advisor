import { StatusCodes } from "http-status-codes";

import { createLogger } from "#server/lib/logger";

const logger = createLogger("withRetry");

const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;

const isRetryableError = (error: unknown): boolean => {
  if (!(error instanceof Error) || !("status" in error)) return true;

  const status = (error as Error & { status: number }).status;

  return (
    status === StatusCodes.TOO_MANY_REQUESTS ||
    status >= StatusCodes.INTERNAL_SERVER_ERROR
  );
};

export type RetryContext = {
  operation: string;
  [key: string]: unknown;
};

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  context: RetryContext,
  options: RetryOptions = {},
): Promise<T> => {
  const { attempts = MAX_RETRY_ATTEMPTS, baseDelayMs = DEFAULT_BASE_DELAY_MS } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error)) throw error;

      if (attempt === attempts) break;

      logger.warn("Attempt failed, retrying", {
        operation: context.operation,
        attempt,
        maxAttempts: attempts,
      });

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
};
