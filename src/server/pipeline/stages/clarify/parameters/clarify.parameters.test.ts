import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackedResponder } from "#pipeline/eval.transcript";
import {
  collectParameters,
  type AmountClassify,
  type TimelineClassify,
} from "#pipeline/stages/clarify/parameters/clarify.parameters";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("collectParameters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createParsedResponse = <T>(output: T): OpenAIResponse<T> => ({
    id: "resp_test",
    usage: undefined,
    output,
  });

  const amountResolved: OpenAIResponse<AmountClassify> = createParsedResponse({
    clarificationNeeded: false,
    clarificationMessage: null,
    amount: 30_000,
  });

  it("should return amount_missing when amount follow-ups are exhausted", async () => {
    const amountNeedsClarification: OpenAIResponse<AmountClassify> = createParsedResponse(
      {
        clarificationNeeded: true,
        clarificationMessage: "Could you give me a specific amount in shekels?",
        amount: null,
      },
    );
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(amountNeedsClarification)
      .mockResolvedValueOnce(amountNeedsClarification);
    const responder = createTrackedResponder(["I'm not sure", "still not sure"]);

    const result = await collectParameters(
      responder.sendToUser,
      responder.waitForResponse,
    );

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.code).toBe("amount_missing");
    }
  });

  it("should return amount_missing when amount converges with null", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<AmountClassify>({
        clarificationNeeded: false,
        clarificationMessage: null,
        amount: null,
      }),
    );
    const responder = createTrackedResponder(["some money"]);

    const result = await collectParameters(
      responder.sendToUser,
      responder.waitForResponse,
    );

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.code).toBe("amount_missing");
    }
  });

  it("should return timeline_missing when timeline follow-ups are exhausted", async () => {
    const timelineNeedsClarification: OpenAIResponse<TimelineClassify> =
      createParsedResponse({
        clarificationNeeded: true,
        clarificationMessage:
          "Could you pick one of these: under 3 years, 3–5 years, 5–10 years, or 10+ years?",
        timeline: null,
      });
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(amountResolved)
      .mockResolvedValueOnce(timelineNeedsClarification)
      .mockResolvedValueOnce(timelineNeedsClarification);
    const responder = createTrackedResponder([
      "₪30,000",
      "I don't know",
      "really can't say",
    ]);

    const result = await collectParameters(
      responder.sendToUser,
      responder.waitForResponse,
    );

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.code).toBe("timeline_missing");
    }
  });

  it("should return timeline_missing when timeline converges with null", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(amountResolved).mockResolvedValueOnce(
      createParsedResponse<TimelineClassify>({
        clarificationNeeded: false,
        clarificationMessage: null,
        timeline: null,
      }),
    );
    const responder = createTrackedResponder(["₪30,000", "someday"]);

    const result = await collectParameters(
      responder.sendToUser,
      responder.waitForResponse,
    );

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.code).toBe("timeline_missing");
    }
  });
});
