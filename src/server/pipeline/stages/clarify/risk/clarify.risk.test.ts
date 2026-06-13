import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackedResponder } from "#pipeline/eval.transcript";
import { collectRisk } from "#pipeline/stages/clarify/risk/clarify.risk";
import type {
  RiskClassify,
  RiskSelfRatingScore,
} from "#pipeline/stages/clarify/risk/clarify.risk.types";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("collectRisk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createParsedResponse = <T>(output: T): OpenAIResponse<T> => ({
    id: "resp_test",
    usage: undefined,
    output,
  });

  const converged = (
    riskSelfRatingScore: RiskSelfRatingScore | null,
  ): OpenAIResponse<RiskClassify> =>
    createParsedResponse({
      clarificationNeeded: false,
      clarificationMessage: null,
      riskSelfRatingScore,
    });

  // The phase emits the raw self-rating; the score→tolerance bucketing now lives
  // in allocation (mapRiskSelfRatingScoreToTolerance), covered by its lib tests.
  it.each<{ score: RiskSelfRatingScore }>([{ score: 1 }, { score: 3 }, { score: 5 }])(
    "should return the converged self-rating score $score",
    async ({ score }) => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(converged(score));
      const responder = createTrackedResponder([String(score)]);

      const result = await collectRisk(responder);

      expect(result).toEqual({
        status: PipelineStatusEnum.enum.completed,
        riskSelfRatingScore: score,
      });
    },
  );

  it("should return unresolved/risk_tolerance when follow-up budget is exhausted", async () => {
    // followUps: 2 → 3 total classification attempts (loop × 2 + final)
    const needsClarification: OpenAIResponse<RiskClassify> = createParsedResponse({
      clarificationNeeded: true,
      clarificationMessage: "Please pick a whole number between 1 and 5.",
      riskSelfRatingScore: null,
    });
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(needsClarification)
      .mockResolvedValueOnce(needsClarification)
      .mockResolvedValueOnce(needsClarification);
    const responder = createTrackedResponder([
      "I don't know",
      "hard to say",
      "I really can't decide",
    ]);

    const result = await collectRisk(responder);

    expect(result.status).toBe(PipelineStatusEnum.enum.unresolved);
    if (result.status === PipelineStatusEnum.enum.unresolved) {
      expect(result.reason).toBe(ClarifyUnresolvedReasonEnum.enum.risk_tolerance);
    }
  });
});
