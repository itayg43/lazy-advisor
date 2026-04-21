import { beforeEach, describe, expect, it, vi } from "vitest";

import { runClarifyStage } from "#pipeline/stages/clarify/clarify.stage";
import { GoalClassification } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { RiskTolerance } from "#schemas/pipeline.schema";
import type { UserProfile } from "#types/pipeline.types";

const {
  mockedClassifyGoal,
  mockedHandleOutOfScopeRedirect,
  mockedHandleUnrealisticExpectations,
  mockedHandleContradictoryRisk,
  mockedCollectFields,
  mockedCollectRisk,
  mockedCollectContribution,
  mockedCollectPreferences,
  mockedExtractUserProfile,
} = vi.hoisted(() => ({
  mockedClassifyGoal: vi.fn(),
  mockedHandleOutOfScopeRedirect: vi.fn(),
  mockedHandleUnrealisticExpectations: vi.fn(),
  mockedHandleContradictoryRisk: vi.fn(),
  mockedCollectFields: vi.fn(),
  mockedCollectRisk: vi.fn(),
  mockedCollectContribution: vi.fn(),
  mockedCollectPreferences: vi.fn(),
  mockedExtractUserProfile: vi.fn(),
}));

vi.mock("#pipeline/stages/clarify/intake/classify/clarify.classify", () => ({
  classifyGoal: mockedClassifyGoal,
}));
vi.mock("#pipeline/stages/clarify/intake/out-of-scope/clarify.out-of-scope", () => ({
  handleOutOfScopeRedirect: mockedHandleOutOfScopeRedirect,
}));
vi.mock("#pipeline/stages/clarify/intake/unrealistic/clarify.unrealistic", () => ({
  handleUnrealisticExpectations: mockedHandleUnrealisticExpectations,
}));
vi.mock("#pipeline/stages/clarify/intake/contradictory/clarify.contradictory", () => ({
  handleContradictoryRisk: mockedHandleContradictoryRisk,
}));
vi.mock("#pipeline/stages/clarify/fields/clarify.fields", () => ({
  collectFields: mockedCollectFields,
}));
vi.mock("#pipeline/stages/clarify/risk/clarify.risk", () => ({
  collectRisk: mockedCollectRisk,
}));
vi.mock("#pipeline/stages/clarify/contribution/clarify.contribution", () => ({
  collectContribution: mockedCollectContribution,
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
    goal: "invest ₪55,000 as a beginner, moderate risk, 20-year horizon, plans to add money periodically",
    amount: 55_000,
    age: 28,
    riskTolerance: RiskTolerance.enum.moderate,
    timeline: "20 years",
    investmentPreferences: "70% FTSE All-World, 30% TLV-125, קרן כספית buffer",
    hasEmergencyFund: true,
    hasDebt: false,
    plansToContribute: true,
  };

  const mockFields = {
    amount: mockProfile.amount,
    age: mockProfile.age,
    timeline: mockProfile.timeline,
    hasEmergencyFund: mockProfile.hasEmergencyFund,
    hasDebt: mockProfile.hasDebt,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedCollectFields.mockResolvedValue(mockFields);
    mockedCollectRisk.mockResolvedValue({ riskTolerance: mockProfile.riskTolerance });
    mockedCollectContribution.mockResolvedValue({ plansToContribute: true });
    mockedCollectPreferences.mockResolvedValue("resp_prefs");
    mockedExtractUserProfile.mockResolvedValue(mockProfile);
  });

  describe("normal classification", () => {
    it("should pass goal directly to collectFields and return profile", async () => {
      mockedClassifyGoal.mockResolvedValue(GoalClassification.enum.normal);

      const result = await runClarifyStage(mockGoal, mockSendToUser, mockWaitForResponse);

      expect(result).toEqual(mockProfile);
      expect(mockedCollectFields).toHaveBeenCalledWith(
        mockGoal,
        mockSendToUser,
        mockWaitForResponse,
      );
      expect(mockedCollectRisk).toHaveBeenCalledWith(
        mockGoal,
        mockFields,
        mockSendToUser,
        mockWaitForResponse,
      );
      expect(mockedHandleOutOfScopeRedirect).not.toHaveBeenCalled();
      expect(mockedHandleUnrealisticExpectations).not.toHaveBeenCalled();
      expect(mockedHandleContradictoryRisk).not.toHaveBeenCalled();
    });
  });

  describe("intake classifications — accepted", () => {
    const acceptedResult = { accepted: true as const, responseId: "resp_intake" };

    it("should chain out_of_scope redirect response into collectFields", async () => {
      mockedClassifyGoal.mockResolvedValue(GoalClassification.enum.out_of_scope);
      mockedHandleOutOfScopeRedirect.mockResolvedValue(acceptedResult);

      const result = await runClarifyStage(mockGoal, mockSendToUser, mockWaitForResponse);

      expect(result).toEqual(mockProfile);
      expect(mockedHandleOutOfScopeRedirect).toHaveBeenCalledWith(
        mockGoal,
        mockSendToUser,
        mockWaitForResponse,
      );
      expect(mockedCollectFields).toHaveBeenCalledWith(
        mockGoal,
        mockSendToUser,
        mockWaitForResponse,
      );
    });

    it("should chain unrealistic redirect response into collectFields", async () => {
      mockedClassifyGoal.mockResolvedValue(GoalClassification.enum.unrealistic);
      mockedHandleUnrealisticExpectations.mockResolvedValue(acceptedResult);

      await runClarifyStage(mockGoal, mockSendToUser, mockWaitForResponse);

      expect(mockedHandleUnrealisticExpectations).toHaveBeenCalledWith(
        mockGoal,
        mockSendToUser,
        mockWaitForResponse,
      );
      expect(mockedCollectFields).toHaveBeenCalledWith(
        mockGoal,
        mockSendToUser,
        mockWaitForResponse,
      );
    });

    it("should chain contradictory redirect response into collectFields", async () => {
      mockedClassifyGoal.mockResolvedValue(GoalClassification.enum.contradictory);
      mockedHandleContradictoryRisk.mockResolvedValue(acceptedResult);

      await runClarifyStage(mockGoal, mockSendToUser, mockWaitForResponse);

      expect(mockedHandleContradictoryRisk).toHaveBeenCalledWith(
        mockGoal,
        mockSendToUser,
        mockWaitForResponse,
      );
      expect(mockedCollectFields).toHaveBeenCalledWith(
        mockGoal,
        mockSendToUser,
        mockWaitForResponse,
      );
    });
  });

  describe("intake classifications — rejected", () => {
    const rejectedResult = { accepted: false as const };

    it("should return null and send closing message when out_of_scope is rejected", async () => {
      mockedClassifyGoal.mockResolvedValue(GoalClassification.enum.out_of_scope);
      mockedHandleOutOfScopeRedirect.mockResolvedValue(rejectedResult);

      const result = await runClarifyStage(mockGoal, mockSendToUser, mockWaitForResponse);

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledTimes(1);
      expect(mockedCollectFields).not.toHaveBeenCalled();
      expect(mockedCollectPreferences).not.toHaveBeenCalled();
      expect(mockedExtractUserProfile).not.toHaveBeenCalled();
    });

    it("should return null and send closing message when unrealistic is rejected", async () => {
      mockedClassifyGoal.mockResolvedValue(GoalClassification.enum.unrealistic);
      mockedHandleUnrealisticExpectations.mockResolvedValue(rejectedResult);

      const result = await runClarifyStage(mockGoal, mockSendToUser, mockWaitForResponse);

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledTimes(1);
      expect(mockedCollectFields).not.toHaveBeenCalled();
    });

    it("should return null and send closing message when contradictory is rejected", async () => {
      mockedClassifyGoal.mockResolvedValue(GoalClassification.enum.contradictory);
      mockedHandleContradictoryRisk.mockResolvedValue(rejectedResult);

      const result = await runClarifyStage(mockGoal, mockSendToUser, mockWaitForResponse);

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledTimes(1);
      expect(mockedCollectFields).not.toHaveBeenCalled();
    });
  });
});
