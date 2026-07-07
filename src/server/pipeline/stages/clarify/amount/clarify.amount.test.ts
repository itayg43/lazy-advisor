import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClassifyErroredReasonEnum } from "#pipeline/ask-with-classify";
import { createTrackedResponder } from "#pipeline/eval.transcript";
import { collectAmount } from "#pipeline/stages/clarify/amount/clarify.amount";
import type { AmountClassify } from "#pipeline/stages/clarify/amount/clarify.amount.types";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("collectAmount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createParsedResponse = <T>(output: T): OpenAIResponse<T> => ({
    id: "resp_test",
    usage: undefined,
    output,
  });

  it("should return completed with amount when it resolves", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<AmountClassify>({
        clarificationNeeded: false,
        clarificationMessage: null,
        amount: 30_000,
      }),
    );
    const responder = createTrackedResponder(["₪30,000"]);

    const result = await collectAmount(responder);

    expect(result).toEqual({
      status: PipelineStatusEnum.enum.completed,
      amount: 30_000,
    });
  });

  it("should return unresolved/amount when follow-ups are exhausted", async () => {
    const needsClarification: OpenAIResponse<AmountClassify> = createParsedResponse({
      clarificationNeeded: true,
      clarificationMessage: "Could you give me a specific amount in shekels?",
      amount: null,
    });
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(needsClarification)
      .mockResolvedValueOnce(needsClarification);
    const responder = createTrackedResponder(["I'm not sure", "still not sure"]);

    const result = await collectAmount(responder);

    expect(result.status).toBe(PipelineStatusEnum.enum.unresolved);
    if (result.status === PipelineStatusEnum.enum.unresolved) {
      expect(result.reason).toBe(ClarifyUnresolvedReasonEnum.enum.amount);
    }
  });

  it("should return errored/classify_resolved_output_invalid when it converges with null", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<AmountClassify>({
        clarificationNeeded: false,
        clarificationMessage: null,
        amount: null,
      }),
    );
    const responder = createTrackedResponder(["some money"]);

    const result = await collectAmount(responder);

    expect(result.status).toBe(PipelineStatusEnum.enum.errored);
    if (result.status === PipelineStatusEnum.enum.errored) {
      expect(result.reason).toBe(
        ClassifyErroredReasonEnum.enum.classify_resolved_output_invalid,
      );
    }
  });

  it("should return errored/classify_message_missing when mid-loop has no clarificationMessage", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<AmountClassify>({
        clarificationNeeded: true,
        clarificationMessage: null,
        amount: null,
      }),
    );
    const responder = createTrackedResponder(["I'm not sure"]);

    const result = await collectAmount(responder);

    expect(result.status).toBe(PipelineStatusEnum.enum.errored);
    if (result.status === PipelineStatusEnum.enum.errored) {
      expect(result.reason).toBe(ClassifyErroredReasonEnum.enum.classify_message_missing);
    }
  });
});
