import { describe, it, expect, vi } from "vitest";

import { withRetry, type RetryContext } from "./with-retry.js";

describe("withRetry", () => {
  const context: RetryContext = {
    operation: "test",
  };

  it("returns the result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await withRetry(fn, context);

    expect(result).toBe("ok");
  });

  it("retries on failure and returns on subsequent success", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("ok");
    const options = {
      baseDelayMs: 0,
    };

    const result = await withRetry(fn, context, options);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after all attempts are exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const options = {
      attempts: 3,
      baseDelayMs: 0,
    };

    await expect(withRetry(fn, context, options)).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respects custom attempt count", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const options = {
      attempts: 2,
      baseDelayMs: 0,
    };

    await expect(withRetry(fn, context, options)).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
