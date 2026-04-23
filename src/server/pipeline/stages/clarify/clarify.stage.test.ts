import type { ResponseOutputItem } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runClarifyStage } from "#pipeline/stages/clarify/clarify.stage";
import { INTAKE_REJECTION_MESSAGES } from "#pipeline/stages/clarify/shared/clarify.constants";
import { GoalClassification } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  AllocationPhaseOutput,
  ContributionPhaseOutput,
  FieldsPhaseOutput,
  RiskScore,
} from "#pipeline/stages/clarify/shared/clarify.types";
import { RiskTolerance, TimelineBucket } from "#schemas/pipeline.schemas";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAI, mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAI: vi.fn(),
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAI: mockedCallOpenAI,
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("clarifyStage", () => {
  const mockSendToUser = vi.fn();
  const mockWaitForResponse = vi.fn<() => Promise<string>>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createLoopResponse = (
    id: string,
    text = "Done.",
  ): OpenAIResponse<ResponseOutputItem[]> => ({
    id,
    usage: undefined,
    output: [
      {
        type: "message",
        id: `msg_${id}`,
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text, annotations: [] }],
      },
    ],
  });

  const createParsedResponse = <T>(output: T, id = "resp_parsed"): OpenAIResponse<T> => ({
    id,
    usage: undefined,
    output,
  });

  const mockFieldsOutput: FieldsPhaseOutput = {
    amount: 50000,
    age: 30,
    timeline: TimelineBucket.enum["10+ years"],
    hasEmergencyFund: true,
    hasDebt: false,
  };

  const mockRiskScore: RiskScore = { selfRatingScore: 3 }; // maps to "moderate"
  const mockAllocationOutput: AllocationPhaseOutput = {
    equityPercentage: 60,
    bufferPercentage: 40,
  };
  const mockContributionOutput: ContributionPhaseOutput = { plansToContribute: true };

  const expectedProfile = {
    amount: 50000,
    age: 30,
    timeline: TimelineBucket.enum["10+ years"],
    hasEmergencyFund: true,
    hasDebt: false,
    riskTolerance: RiskTolerance.enum.moderate,
    equityPercentage: 60,
    bufferPercentage: 40,
    plansToContribute: true,
  };

  // Sets up callOpenAIParsed for the four phase extractions in execution order.
  // Always call after the classify mock so the queue order matches execution.
  const setupPhaseParsedMocks = () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(createParsedResponse(mockFieldsOutput, "resp_fields"))
      .mockResolvedValueOnce(createParsedResponse(mockRiskScore, "resp_risk"))
      .mockResolvedValueOnce(
        createParsedResponse(mockAllocationOutput, "resp_allocation"),
      )
      .mockResolvedValueOnce(
        createParsedResponse(mockContributionOutput, "resp_contribution"),
      );
  };

  // Sets up callOpenAI loop responses for the four phases in execution order.
  // Prepend any intake loop call before invoking this.
  const setupPhaseLoopMocks = () => {
    mockedCallOpenAI
      .mockResolvedValueOnce(createLoopResponse("resp_fields_loop"))
      .mockResolvedValueOnce(createLoopResponse("resp_risk_loop"))
      .mockResolvedValueOnce(createLoopResponse("resp_allocation_loop"))
      .mockResolvedValueOnce(createLoopResponse("resp_contribution_loop"));
  };

  describe("normal goal", () => {
    it("should return assembled UserProfile and run all phases", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassification.enum.normal }, "resp_classify"),
      );
      setupPhaseParsedMocks();
      setupPhaseLoopMocks();

      const result = await runClarifyStage(
        "I want to invest ₪50,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockWaitForResponse).not.toHaveBeenCalled();
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(4);
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(5); // classify + 4 extractions
    });
  });

  describe("out-of-scope intake", () => {
    it("should complete full flow when accepted", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse(
          { type: GoalClassification.enum.out_of_scope },
          "resp_classify",
        ),
      );
      setupPhaseParsedMocks();
      mockedCallOpenAI
        .mockResolvedValueOnce(createLoopResponse("resp_oos_intake", "Got it."))
        .mockResolvedValueOnce(createLoopResponse("resp_fields_loop"))
        .mockResolvedValueOnce(createLoopResponse("resp_risk_loop"))
        .mockResolvedValueOnce(createLoopResponse("resp_allocation_loop"))
        .mockResolvedValueOnce(createLoopResponse("resp_contribution_loop"));

      const result = await runClarifyStage(
        "I want to buy NVIDIA",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(5); // intake + 4 phases
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(5); // classify + 4 extractions
    });

    it("should return null, send rejection message, and stop after intake when rejected", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse(
          { type: GoalClassification.enum.out_of_scope },
          "resp_classify",
        ),
      );
      mockedCallOpenAI.mockResolvedValueOnce(
        createLoopResponse("resp_oos_intake", "Understood."),
      );

      const result = await runClarifyStage(
        "I want to buy NVIDIA",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledWith(INTAKE_REJECTION_MESSAGES.out_of_scope);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(1);
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(1); // classify only
    });
  });

  describe("unrealistic intake", () => {
    it("should complete full flow when accepted", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse(
          { type: GoalClassification.enum.unrealistic },
          "resp_classify",
        ),
      );
      setupPhaseParsedMocks();
      mockedCallOpenAI
        .mockResolvedValueOnce(createLoopResponse("resp_unreal_intake", "Got it."))
        .mockResolvedValueOnce(createLoopResponse("resp_fields_loop"))
        .mockResolvedValueOnce(createLoopResponse("resp_risk_loop"))
        .mockResolvedValueOnce(createLoopResponse("resp_allocation_loop"))
        .mockResolvedValueOnce(createLoopResponse("resp_contribution_loop"));

      const result = await runClarifyStage(
        "I want to double my money in a month",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(5); // intake + 4 phases
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(5); // classify + 4 extractions
    });

    it("should return null, send rejection message, and stop after intake when rejected", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse(
          { type: GoalClassification.enum.unrealistic },
          "resp_classify",
        ),
      );
      mockedCallOpenAI.mockResolvedValueOnce(
        createLoopResponse("resp_unreal_intake", "Understood."),
      );

      const result = await runClarifyStage(
        "I want to double my money in a month",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledWith(INTAKE_REJECTION_MESSAGES.unrealistic);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(1);
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(1); // classify only
    });
  });

  describe("contradictory intake", () => {
    it("should complete full flow when accepted", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse(
          { type: GoalClassification.enum.contradictory },
          "resp_classify",
        ),
      );
      setupPhaseParsedMocks();
      mockedCallOpenAI
        .mockResolvedValueOnce(createLoopResponse("resp_contra_intake", "Got it."))
        .mockResolvedValueOnce(createLoopResponse("resp_fields_loop"))
        .mockResolvedValueOnce(createLoopResponse("resp_risk_loop"))
        .mockResolvedValueOnce(createLoopResponse("resp_allocation_loop"))
        .mockResolvedValueOnce(createLoopResponse("resp_contribution_loop"));

      const result = await runClarifyStage(
        "I want max returns but can't lose money",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(5); // intake + 4 phases
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(5); // classify + 4 extractions
    });

    it("should return null, send rejection message, and stop after intake when rejected", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse(
          { type: GoalClassification.enum.contradictory },
          "resp_classify",
        ),
      );
      mockedCallOpenAI.mockResolvedValueOnce(
        createLoopResponse("resp_contra_intake", "Understood."),
      );

      const result = await runClarifyStage(
        "I want max returns but can't lose money",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledWith(
        INTAKE_REJECTION_MESSAGES.contradictory,
      );
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(1);
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(1); // classify only
    });
  });
});
