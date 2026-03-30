import type { ResponseOutputItem } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InternalError, ServiceUnavailableError } from "#server/errors";
import { mockTokenUsage } from "#server/mocks/openai.service.mock";
import { KnowledgeLevel, RiskTolerance } from "#server/schemas/pipeline.schema";
import type { OpenAIResponse } from "#server/services/openai";
import type { ResearchSummary, UserProfile } from "#server/types/pipeline.types";
import { runResearchStage } from "./research.stage";

const { mockedCallOpenAI, mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAI: vi.fn(),
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#server/services/openai", () => ({
  callOpenAI: mockedCallOpenAI,
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("researchStage", () => {
  const mockProfile: UserProfile = {
    goal: "invest ₪55,000 in ETFs as a beginner",
    amount: 55_000,
    age: 28,
    riskTolerance: RiskTolerance.enum.moderate,
    timeline: "20 years",
    location: "Israel",
    knowledgeLevel: KnowledgeLevel.enum.beginner,
    brokerage: "none",
    hasEmergencyFund: true,
    hasDebt: false,
    monthlyContribution: 1_800,
  };

  // TODO: Update mock data after running full-loop evals (4.4) to reflect
  // realistic research output structure, ETF details, and source URLs.
  const mockResearchSummary: ResearchSummary = {
    recommendedEtfs: [
      {
        ticker: "VWRA",
        name: "Vanguard FTSE All-World UCITS ETF (USD) Accumulating",
        expenseRatio: "0.22",
        reasoning:
          "Broad global equity exposure across developed and emerging markets. Irish-domiciled accumulating structure provides tax efficiency for Israeli investors via the Ireland-US tax treaty (15% withholding vs 25%).",
        risks:
          "Full equity exposure means high volatility in downturns. Currency risk from USD-denominated holdings.",
        sourceUrl:
          "https://www.vanguard.co.uk/professional/product/etf/equity/9679/ftse-all-world-ucits-etf-usd-accumulating",
      },
      {
        ticker: "AGGU",
        name: "iShares Core Global Aggregate Bond UCITS ETF (USD) Accumulating",
        expenseRatio: "0.10",
        reasoning:
          "Global bond exposure for portfolio stability. Accumulating Irish-domiciled structure maintains tax efficiency. Provides ballast during equity drawdowns.",
        risks:
          "Rising interest rates reduce bond prices. Low expected returns compared to equities over long horizons.",
        sourceUrl:
          "https://www.ishares.com/uk/individual/en/products/291770/ishares-core-global-aggregate-bond-ucits-etf",
      },
    ],
    brokerageRecommendation:
      "Open a Meitav self-directed trading account (חשבון מסחר עצמאי). Meitav offers international ETF access and handles Israeli tax reporting automatically. Alternatively, IBI or Interactive Brokers Israel are viable options.",
    allocationRationale:
      "80% equity / 20% bonds allocation suitable for a 28-year-old moderate-risk investor with a 20-year horizon. The equity portion provides growth while bonds reduce portfolio volatility.",
  };

  // TODO: Update after full-loop evals (4.4) — the real research response
  // includes web_search_call items and url_citation annotations in the output.
  const createResearchResponse = (): OpenAIResponse<ResponseOutputItem[]> => ({
    id: "resp_research_done",
    output: [
      {
        type: "message",
        id: "msg_research_done",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text: "Based on my research, here are the findings for an Israeli beginner investor...",
            annotations: [],
          },
        ],
      },
    ],
    usage: mockTokenUsage,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns extracted research summary", async () => {
    mockedCallOpenAI.mockResolvedValue(createResearchResponse());
    mockedCallOpenAIParsed.mockResolvedValue({
      output: mockResearchSummary,
    });

    const result = await runResearchStage(mockProfile);

    expect(result).toEqual(mockResearchSummary);
  });

  it("propagates callOpenAI error from research phase", async () => {
    mockedCallOpenAI.mockRejectedValue(
      new ServiceUnavailableError("OpenAI API is unavailable"),
    );

    await expect(runResearchStage(mockProfile)).rejects.toThrow(ServiceUnavailableError);

    expect(mockedCallOpenAIParsed).not.toHaveBeenCalled();
  });

  it("propagates callOpenAIParsed error from extraction phase", async () => {
    mockedCallOpenAI.mockResolvedValue(createResearchResponse());
    mockedCallOpenAIParsed.mockRejectedValue(new InternalError("Parsed output is null"));

    await expect(runResearchStage(mockProfile)).rejects.toThrow(InternalError);
  });
});
