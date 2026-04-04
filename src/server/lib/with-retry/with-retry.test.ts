import { describe, expect, it, vi } from "vitest";

import { BadRequestError, ServiceUnavailableError, TooManyRequestsError } from "#errors";
import {
  withRetry,
  type RetryContext,
  type RetryOptions,
} from "#lib/with-retry/with-retry";

describe("withRetry", () => {
  const mockContext: RetryContext = {
    operation: "test",
  };

  it("should return the result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await withRetry(fn, mockContext);

    expect(result).toBe("ok");
  });

  it("should retry on failure and return on subsequent success", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("ok");
    const options: RetryOptions = {
      baseDelayMs: 0,
    };

    const result = await withRetry(fn, mockContext, options);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should throw after all attempts are exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const options: RetryOptions = {
      attempts: 3,
      baseDelayMs: 0,
    };

    await expect(withRetry(fn, mockContext, options)).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw immediately on non-retryable 4xx error", async () => {
    const fn = vi.fn().mockRejectedValue(new BadRequestError("bad request"));
    const options: RetryOptions = {
      attempts: 3,
      baseDelayMs: 0,
    };

    await expect(withRetry(fn, mockContext, options)).rejects.toThrow("bad request");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on 429 rate limit error", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TooManyRequestsError("rate limited"))
      .mockResolvedValueOnce("ok");
    const options: RetryOptions = {
      baseDelayMs: 0,
    };

    const result = await withRetry(fn, mockContext, options);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should retry on 5xx server error", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ServiceUnavailableError("unavailable"))
      .mockResolvedValueOnce("ok");
    const options: RetryOptions = {
      baseDelayMs: 0,
    };

    const result = await withRetry(fn, mockContext, options);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
