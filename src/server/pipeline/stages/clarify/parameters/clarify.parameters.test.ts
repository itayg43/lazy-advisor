import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackedResponder } from "#pipeline/eval.transcript";
import { collectParameters } from "#pipeline/stages/clarify/parameters/clarify.parameters";
import type {
  AmountClassify,
  TimelineClassify,
} from "#pipeline/stages/clarify/parameters/clarify.parameters.types";
import {
  ClarifyErroredReasonEnum,
  ClarifyUnresolvedReasonEnum,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";
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

  it("should return unresolved/amount when amount follow-ups are exhausted", async () => {
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

    const result = await collectParameters(responder);

    expect(result.status).toBe(PipelineStatusEnum.enum.unresolved);
    if (result.status === PipelineStatusEnum.enum.unresolved) {
      expect(result.reason).toBe(ClarifyUnresolvedReasonEnum.enum.amount);
    }
  });

  it("should return errored/classify_output_invalid when amount converges with null", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<AmountClassify>({
        clarificationNeeded: false,
        clarificationMessage: null,
        amount: null,
      }),
    );
    const responder = createTrackedResponder(["some money"]);

    const result = await collectParameters(responder);

    expect(result.status).toBe(PipelineStatusEnum.enum.errored);
    if (result.status === PipelineStatusEnum.enum.errored) {
      expect(result.reason).toBe(ClarifyErroredReasonEnum.enum.classify_output_invalid);
    }
  });

  it("should return errored/classify_message_missing when amount mid-loop has no clarificationMessage", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<AmountClassify>({
        clarificationNeeded: true,
        clarificationMessage: null,
        amount: null,
      }),
    );
    const responder = createTrackedResponder(["I'm not sure"]);

    const result = await collectParameters(responder);

    expect(result.status).toBe(PipelineStatusEnum.enum.errored);
    if (result.status === PipelineStatusEnum.enum.errored) {
      expect(result.reason).toBe(ClarifyErroredReasonEnum.enum.classify_message_missing);
    }
  });

  it("should return unresolved/timeline when timeline follow-ups are exhausted", async () => {
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

    const result = await collectParameters(responder);

    expect(result.status).toBe(PipelineStatusEnum.enum.unresolved);
    if (result.status === PipelineStatusEnum.enum.unresolved) {
      expect(result.reason).toBe(ClarifyUnresolvedReasonEnum.enum.timeline);
    }
  });

  it("should return errored/classify_output_invalid when timeline converges with null", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(amountResolved).mockResolvedValueOnce(
      createParsedResponse<TimelineClassify>({
        clarificationNeeded: false,
        clarificationMessage: null,
        timeline: null,
      }),
    );
    const responder = createTrackedResponder(["₪30,000", "someday"]);

    const result = await collectParameters(responder);

    expect(result.status).toBe(PipelineStatusEnum.enum.errored);
    if (result.status === PipelineStatusEnum.enum.errored) {
      expect(result.reason).toBe(ClarifyErroredReasonEnum.enum.classify_output_invalid);
    }
  });

  it("should return errored/classify_message_missing when timeline mid-loop has no clarificationMessage", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(amountResolved).mockResolvedValueOnce(
      createParsedResponse<TimelineClassify>({
        clarificationNeeded: true,
        clarificationMessage: null,
        timeline: null,
      }),
    );
    const responder = createTrackedResponder(["₪30,000", "someday"]);

    const result = await collectParameters(responder);

    expect(result.status).toBe(PipelineStatusEnum.enum.errored);
    if (result.status === PipelineStatusEnum.enum.errored) {
      expect(result.reason).toBe(ClarifyErroredReasonEnum.enum.classify_message_missing);
    }
  });
});
