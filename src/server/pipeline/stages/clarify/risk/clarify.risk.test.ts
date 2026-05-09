import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackedResponder } from "#pipeline/eval.transcript";
import {
  collectRisk,
  type RiskClassify,
} from "#pipeline/stages/clarify/risk/clarify.risk";
import { RiskTolerance } from "#schemas/pipeline.schemas";
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

  const { conservative, moderate, aggressive } = RiskTolerance.enum;

  const createParsedResponse = <T>(output: T): OpenAIResponse<T> => ({
    id: "resp_test",
    usage: undefined,
    output,
  });

  const converged = (selfRatingScore: number | null): OpenAIResponse<RiskClassify> =>
    createParsedResponse({
      clarificationNeeded: false,
      clarificationMessage: null,
      selfRatingScore,
    });

  // One case per mapScoreToBucket branch: ≤2 → conservative, =3 → moderate, >3 → aggressive
  it.each([
    { score: 2, riskTolerance: conservative },
    { score: 3, riskTolerance: moderate },
    { score: 4, riskTolerance: aggressive },
  ])("should map score $score to $riskTolerance", async ({ score, riskTolerance }) => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(converged(score));
    const responder = createTrackedResponder([String(score)]);

    const result = await collectRisk(responder.sendToUser, responder.waitForResponse);

    expect(result).toEqual({ status: "success", selfRatingScore: score, riskTolerance });
  });

  it("should return risk_missing when score converges as null", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(converged(null));
    const responder = createTrackedResponder(["I don't know"]);

    const result = await collectRisk(responder.sendToUser, responder.waitForResponse);

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.reason).toBe("risk_missing");
    }
  });

  it("should return risk_missing when follow-up budget is exhausted", async () => {
    // followUps: 2 → 3 total classification attempts (loop × 2 + final)
    const needsClarification: OpenAIResponse<RiskClassify> = createParsedResponse({
      clarificationNeeded: true,
      clarificationMessage: "Please pick a whole number between 1 and 5.",
      selfRatingScore: null,
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

    const result = await collectRisk(responder.sendToUser, responder.waitForResponse);

    expect(result.status).toBe("failure");
    if (result.status === "failure") {
      expect(result.reason).toBe("risk_missing");
    }
  });
});
