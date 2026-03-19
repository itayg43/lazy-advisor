import { MAX_RETRY_ATTEMPTS } from "../../../shared/constants/constants.js";

const DEFAULT_BASE_DELAY_MS = 500;

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

      if (attempt === attempts) break;

      // TODO: replace with structured logger (Section 10)
      console.warn(
        `[${context.operation}] Attempt ${String(attempt)}/${String(attempts)} failed, retrying...`,
      );

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
};
