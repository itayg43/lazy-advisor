import { beforeEach, describe, expect, it, vi } from "vitest";

import { runClarifyStage } from "#pipeline/stages/clarify/clarify.stage";
import { KnowledgeLevel, RiskTolerance } from "#schemas/pipeline.schema";
import type { UserProfile } from "#types/pipeline.types";

const { mockedCollectFields, mockedCollectPreferences, mockedExtractUserProfile } =
  vi.hoisted(() => ({
    mockedCollectFields: vi.fn(),
    mockedCollectPreferences: vi.fn(),
    mockedExtractUserProfile: vi.fn(),
  }));

vi.mock("#pipeline/stages/clarify/fields/clarify.fields", () => ({
  collectFields: mockedCollectFields,
}));
vi.mock("#pipeline/stages/clarify/preferences/clarify.preferences", () => ({
  collectPreferences: mockedCollectPreferences,
}));
vi.mock("#pipeline/stages/clarify/extraction/clarify.extraction", () => ({
  extractUserProfile: mockedExtractUserProfile,
}));

describe("runClarifyStage", () => {
  const mockGoal = "I have ₪55,000 and want to start investing in ETFs";
  const mockSendToUser = vi.fn();
  const mockWaitForResponse = vi.fn<() => Promise<string>>();

  const mockProfile: UserProfile = {
    goal: "invest ₪55,000 as a beginner, moderate risk, 20-year horizon with ₪1,800/month contributions",
    amount: 55_000,
    age: 28,
    riskTolerance: RiskTolerance.enum.moderate,
    timeline: "20 years",
    knowledgeLevel: KnowledgeLevel.enum.beginner,
    brokerage: "none",
    investmentPreferences: "70% FTSE All-World, 30% TLV-125, קרן כספית buffer",
    hasEmergencyFund: true,
    hasDebt: false,
    monthlyContribution: 1_800,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should orchestrate fields, preferences, and extraction in order", async () => {
    mockedCollectFields.mockResolvedValue("resp_fields");
    mockedCollectPreferences.mockResolvedValue("resp_prefs");
    mockedExtractUserProfile.mockResolvedValue(mockProfile);

    const result = await runClarifyStage(mockGoal, mockSendToUser, mockWaitForResponse);

    expect(result).toEqual(mockProfile);
    expect(mockedCollectFields).toHaveBeenCalledWith(
      mockGoal,
      mockSendToUser,
      mockWaitForResponse,
    );
    expect(mockedCollectPreferences).toHaveBeenCalledWith(
      "resp_fields",
      mockSendToUser,
      mockWaitForResponse,
    );
    expect(mockedExtractUserProfile).toHaveBeenCalledWith("resp_prefs");
  });
});
