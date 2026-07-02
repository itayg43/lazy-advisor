import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackedResponder } from "#pipeline/eval.transcript";
import { collectContribution } from "#pipeline/stages/clarify/contribution/clarify.contribution";
import type { ContributionClassify } from "#pipeline/stages/clarify/contribution/clarify.contribution.types";
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

  const mockAmount = 50_000;
  const mockEquityPercentage = 60;

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

  it.each([
    { answer: "yes" as const, plansToContribute: true },
    { answer: "no" as const, plansToContribute: false },
  ])(
    "should return $plansToContribute when user answers $answer",
    async ({ answer, plansToContribute }) => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(converged(answer));
      const responder = createTrackedResponder([answer]);

      const result = await collectContribution(
        mockAmount,
        mockEquityPercentage,
        responder,
      );

      expect(result).toEqual({ plansToContribute });
    },
  );

  it("should return false when follow-ups are exhausted", async () => {
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

    const result = await collectContribution(mockAmount, mockEquityPercentage, responder);

    expect(result).toEqual({ plansToContribute: false });
  });
});
