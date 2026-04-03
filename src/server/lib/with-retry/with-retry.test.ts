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

  it("returns the result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await withRetry(fn, mockContext);

    expect(result).toBe("ok");
  });

  it("retries on failure and returns on subsequent success", async () => {
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

  it("throws after all attempts are exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const options: RetryOptions = {
      attempts: 3,
      baseDelayMs: 0,
    };

    await expect(withRetry(fn, mockContext, options)).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respects custom attempt count", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const options: RetryOptions = {
      attempts: 2,
      baseDelayMs: 0,
    };

    await expect(withRetry(fn, mockContext, options)).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws immediately on non-retryable 4xx error", async () => {
    const fn = vi.fn().mockRejectedValue(new BadRequestError("bad request"));
    const options: RetryOptions = {
      attempts: 3,
      baseDelayMs: 0,
    };

    await expect(withRetry(fn, mockContext, options)).rejects.toThrow("bad request");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 rate limit error", async () => {
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

  it("retries on 5xx server error", async () => {
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

  it("retries on error without status property", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce("ok");
    const options: RetryOptions = {
      baseDelayMs: 0,
    };

    const result = await withRetry(fn, mockContext, options);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
