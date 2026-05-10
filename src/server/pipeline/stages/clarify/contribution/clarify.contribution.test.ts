import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackedResponder } from "#pipeline/eval.transcript";
import {
  collectContribution,
  type ContributionClassify,
} from "#pipeline/stages/clarify/contribution/clarify.contribution";
import { ClarifyErroredReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  AllocationPhaseOutput,
  ParametersPhaseOutput,
} from "#pipeline/stages/clarify/shared/clarify.types";
import { PipelineStatusEnum, TimelineBucketEnum } from "#schemas/pipeline.schemas";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("collectContribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const parameters: ParametersPhaseOutput = {
    amount: 50_000,
    timeline: TimelineBucketEnum.enum["10+ years"],
  };

  const allocation: AllocationPhaseOutput = {
    equityPercentage: 60,
    bufferPercentage: 40,
  };

  const createParsedResponse = <T>(output: T): OpenAIResponse<T> => ({
    id: "resp_test",
    usage: undefined,
    output,
  });

  const converged = (answer: "yes" | "no"): OpenAIResponse<ContributionClassify> =>
    createParsedResponse({
      clarificationNeeded: false,
      clarificationMessage: null,
      answer,
    });

  it("should return completed/true when user answers yes", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(converged("yes"));
    const responder = createTrackedResponder(["yes"]);

    const result = await collectContribution(
      parameters,
      allocation,
      responder.sendToUser,
      responder.waitForResponse,
    );

    expect(result).toEqual({
      status: PipelineStatusEnum.enum.completed,
      plansToContribute: true,
    });
  });

  it("should return completed/false when user answers no", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(converged("no"));
    const responder = createTrackedResponder(["no"]);

    const result = await collectContribution(
      parameters,
      allocation,
      responder.sendToUser,
      responder.waitForResponse,
    );

    expect(result).toEqual({
      status: PipelineStatusEnum.enum.completed,
      plansToContribute: false,
    });
  });

  // Rule 5 coverage: vague input classifies as answer: "no" per classify instructions →
  // same completed/false outcome as an explicit no. Deterministic code path, no eval needed.
  it("should return completed/false when classify model resolves vague input as no", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(converged("no"));
    const responder = createTrackedResponder(["maybe someday"]);

    const result = await collectContribution(
      parameters,
      allocation,
      responder.sendToUser,
      responder.waitForResponse,
    );

    expect(result).toEqual({
      status: PipelineStatusEnum.enum.completed,
      plansToContribute: false,
    });
  });

  it("should return completed/false when follow-ups are exhausted", async () => {
    // followUps: 2 → 3 total classification attempts (loop × 2 + final)
    const needsClarification: OpenAIResponse<ContributionClassify> = createParsedResponse(
      {
        clarificationNeeded: true,
        clarificationMessage: "Could you clarify?",
        answer: null,
      },
    );
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(needsClarification)
      .mockResolvedValueOnce(needsClarification)
      .mockResolvedValueOnce(needsClarification);
    const responder = createTrackedResponder([
      "What does DCA mean?",
      "Still not sure",
      "I really can't say",
    ]);

    const result = await collectContribution(
      parameters,
      allocation,
      responder.sendToUser,
      responder.waitForResponse,
    );

    expect(result).toEqual({
      status: PipelineStatusEnum.enum.completed,
      plansToContribute: false,
    });
  });

  it("should return errored/classify_output_invalid when answer converges as null", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<ContributionClassify>({
        clarificationNeeded: false,
        clarificationMessage: null,
        answer: null,
      }),
    );
    const responder = createTrackedResponder(["unclear"]);

    const result = await collectContribution(
      parameters,
      allocation,
      responder.sendToUser,
      responder.waitForResponse,
    );

    expect(result.status).toBe(PipelineStatusEnum.enum.errored);
    if (result.status === PipelineStatusEnum.enum.errored) {
      expect(result.reason).toBe(ClarifyErroredReasonEnum.enum.classify_output_invalid);
    }
  });

  it("should return errored/classify_message_missing when mid-loop clarificationMessage is null", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<ContributionClassify>({
        clarificationNeeded: true,
        clarificationMessage: null,
        answer: null,
      }),
    );
    const responder = createTrackedResponder(["unclear"]);

    const result = await collectContribution(
      parameters,
      allocation,
      responder.sendToUser,
      responder.waitForResponse,
    );

    expect(result.status).toBe(PipelineStatusEnum.enum.errored);
    if (result.status === PipelineStatusEnum.enum.errored) {
      expect(result.reason).toBe(ClarifyErroredReasonEnum.enum.classify_message_missing);
    }
  });
});
