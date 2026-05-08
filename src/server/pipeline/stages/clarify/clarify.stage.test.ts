import type { ResponseOutputItem } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runClarifyStage } from "#pipeline/stages/clarify/clarify.stage";
import type {
  EmergencyFundClassify,
  DebtClassify,
} from "#pipeline/stages/clarify/ef-debt/clarify.ef-debt";
import type {
  AmountClassify,
  TimelineClassify,
} from "#pipeline/stages/clarify/parameters/clarify.parameters";
import {
  ALLOCATION_EXIT_MESSAGE,
  AMOUNT_EXIT_MESSAGE,
  INTAKE_REJECTION_MESSAGES,
  MAX_ALLOCATION_TOOL_CALLS,
  PROFILE_TRANSITION_MESSAGE,
  SHORT_TIMELINE_EXIT_MESSAGE,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import * as clarifyPhase from "#pipeline/stages/clarify/shared/clarify.phase";
import { PhaseBudgetExhaustedError } from "#pipeline/stages/clarify/shared/clarify.phase";
import { GoalClassification } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  AllocationPhaseOutput,
  ContributionPhaseOutput,
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

  const mockAmountOutput: AmountClassify = {
    clarificationNeeded: false,
    clarificationMessage: null,
    amount: 50000,
  };

  const mockTimelineOutput: TimelineClassify = {
    clarificationNeeded: false,
    clarificationMessage: null,
    timeline: TimelineBucket.enum["10+ years"],
  };

  const mockRiskScore: RiskScore = { selfRatingScore: 3 }; // maps to "moderate"

  const mockAllocationOutput: AllocationPhaseOutput = {
    equityPercentage: 60,
    bufferPercentage: 40,
  };

  const mockContributionOutput: ContributionPhaseOutput = { plansToContribute: true };

  const expectedProfile = {
    amount: 50000,
    timeline: TimelineBucket.enum["10+ years"],
    riskTolerance: RiskTolerance.enum.moderate,
    equityPercentage: 60,
    bufferPercentage: 40,
    plansToContribute: true,
  };

  // Sets up callOpenAIParsed for the two ef-debt question classifications, in order.
  // Also sets up waitForResponse to return user answers for both questions.
  // Call after the classify (and any intake extraction) mocks, before setupParametersParsedMocks.
  const mockEfOutput: EmergencyFundClassify = {
    clarificationNeeded: false,
    clarificationMessage: null,
    answer: "yes",
  };

  const mockDebtOutput: DebtClassify = {
    clarificationNeeded: false,
    clarificationMessage: null,
    answer: "no",
  };

  const setupEfDebtParsedMocks = () => {
    mockWaitForResponse.mockResolvedValueOnce("yes").mockResolvedValueOnce("no");
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(createParsedResponse(mockEfOutput, "resp_ef"))
      .mockResolvedValueOnce(createParsedResponse(mockDebtOutput, "resp_debt"));
  };

  // Sets up callOpenAIParsed for the two parameters question classifications, in order.
  // Also sets up waitForResponse to return user answers for both questions.
  // Call after ef-debt mocks, before setupPhaseParsedMocks.
  const setupParametersParsedMocks = () => {
    mockWaitForResponse
      .mockResolvedValueOnce("₪50,000")
      .mockResolvedValueOnce("10+ years");
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(createParsedResponse(mockAmountOutput, "resp_amount"))
      .mockResolvedValueOnce(createParsedResponse(mockTimelineOutput, "resp_timeline"));
  };

  // Sets up callOpenAIParsed for the three phase extractions (risk, allocation, contribution).
  // Always call after classify, ef-debt, and parameters mocks so the queue order matches execution.
  const setupPhaseParsedMocks = () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(createParsedResponse(mockRiskScore, "resp_risk"))
      .mockResolvedValueOnce(
        createParsedResponse(mockAllocationOutput, "resp_allocation"),
      )
      .mockResolvedValueOnce(
        createParsedResponse(mockContributionOutput, "resp_contribution"),
      );
  };

  // Sets up callOpenAI loop responses for the three loop phases (risk, allocation, contribution).
  // Prepend any intake loop call before invoking this.
  // ef-debt and parameters use askWithClassify (callOpenAIParsed) — not loops.
  const setupPhaseLoopMocks = () => {
    mockedCallOpenAI
      .mockResolvedValueOnce(createLoopResponse("resp_risk_loop"))
      .mockResolvedValueOnce(createLoopResponse("resp_allocation_loop"))
      .mockResolvedValueOnce(createLoopResponse("resp_contribution_loop"));
  };

  describe("normal goal", () => {
    it("should return assembled UserProfile and run all phases", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassification.enum.normal }, "resp_classify"),
      );
      setupEfDebtParsedMocks();
      setupParametersParsedMocks();
      setupPhaseParsedMocks();
      setupPhaseLoopMocks();

      const result = await runClarifyStage(
        "I want to invest ₪50,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockWaitForResponse).toHaveBeenCalledTimes(4); // EF + debt + amount + timeline
      expect(mockSendToUser).toHaveBeenCalledTimes(5); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(3); // risk + allocation + contribution loops
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(8); // classify + EF + debt + amount + timeline + 3 extractions
    });
  });

  describe("out-of-scope intake", () => {
    it("should complete full flow when accepted", async () => {
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(
          createParsedResponse(
            { type: GoalClassification.enum.out_of_scope },
            "resp_classify",
          ),
        )
        .mockResolvedValueOnce(
          createParsedResponse({ accepted: true }, "resp_oos_extraction"),
        );
      setupEfDebtParsedMocks();
      setupParametersParsedMocks();
      setupPhaseParsedMocks();
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse("resp_oos_intake"));
      setupPhaseLoopMocks();

      const result = await runClarifyStage(
        "I want to buy NVIDIA",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockSendToUser).toHaveBeenCalledTimes(5); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(4); // intake loop + risk + allocation + contribution
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(9); // classify + intake extraction + EF + debt + amount + timeline + 3 extractions
    });

    it("should return null, send rejection message, and stop after intake when rejected", async () => {
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(
          createParsedResponse(
            { type: GoalClassification.enum.out_of_scope },
            "resp_classify",
          ),
        )
        .mockResolvedValueOnce(
          createParsedResponse({ accepted: false }, "resp_oos_extraction"),
        );
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse("resp_oos_intake"));

      const result = await runClarifyStage(
        "I want to buy NVIDIA",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledTimes(1);
      expect(mockSendToUser).toHaveBeenCalledWith(INTAKE_REJECTION_MESSAGES.out_of_scope);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(1);
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(2); // classify + intake extraction
    });
  });

  describe("unrealistic intake", () => {
    it("should complete full flow when accepted", async () => {
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(
          createParsedResponse(
            { type: GoalClassification.enum.unrealistic },
            "resp_classify",
          ),
        )
        .mockResolvedValueOnce(
          createParsedResponse({ accepted: true }, "resp_unreal_extraction"),
        );
      setupEfDebtParsedMocks();
      setupParametersParsedMocks();
      setupPhaseParsedMocks();
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse("resp_unreal_intake"));
      setupPhaseLoopMocks();

      const result = await runClarifyStage(
        "I want to double my money in a month",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockSendToUser).toHaveBeenCalledTimes(5); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(4); // intake loop + risk + allocation + contribution
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(9); // classify + intake extraction + EF + debt + amount + timeline + 3 extractions
    });

    it("should return null, send rejection message, and stop after intake when rejected", async () => {
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(
          createParsedResponse(
            { type: GoalClassification.enum.unrealistic },
            "resp_classify",
          ),
        )
        .mockResolvedValueOnce(
          createParsedResponse({ accepted: false }, "resp_unreal_extraction"),
        );
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse("resp_unreal_intake"));

      const result = await runClarifyStage(
        "I want to double my money in a month",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledTimes(1);
      expect(mockSendToUser).toHaveBeenCalledWith(INTAKE_REJECTION_MESSAGES.unrealistic);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(1);
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(2); // classify + intake extraction
    });
  });

  describe("amount-missing exit", () => {
    it("should return null, send AMOUNT_EXIT_MESSAGE, and skip risk/allocation/contribution when amount cannot be collected", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassification.enum.normal }, "resp_classify"),
      );
      setupEfDebtParsedMocks();
      mockWaitForResponse.mockResolvedValueOnce("I don't know");
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse(
          { clarificationNeeded: false, clarificationMessage: null, amount: null },
          "resp_amount",
        ),
      );

      const result = await runClarifyStage(
        "I want to invest some money",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledTimes(5); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + AMOUNT_EXIT
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockSendToUser).toHaveBeenNthCalledWith(5, AMOUNT_EXIT_MESSAGE);
      expect(mockedCallOpenAI).not.toHaveBeenCalled();
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(4); // classify + EF + debt + amount
    });
  });

  describe("short-timeline exit", () => {
    it("should return null, send exit message, and skip risk/allocation/contribution when timeline is under 3 years", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassification.enum.normal }, "resp_classify"),
      );
      setupEfDebtParsedMocks();
      mockWaitForResponse
        .mockResolvedValueOnce("₪20,000")
        .mockResolvedValueOnce("under 3 years");
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(
          createParsedResponse(
            { clarificationNeeded: false, clarificationMessage: null, amount: 20000 },
            "resp_amount",
          ),
        )
        .mockResolvedValueOnce(
          createParsedResponse(
            {
              clarificationNeeded: false,
              clarificationMessage: null,
              timeline: TimelineBucket.enum["under 3 years"],
            },
            "resp_timeline",
          ),
        );

      const result = await runClarifyStage(
        "I want to invest ₪20,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledTimes(6); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q + SHORT_TIMELINE_EXIT
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockSendToUser).toHaveBeenNthCalledWith(6, SHORT_TIMELINE_EXIT_MESSAGE);
      expect(mockedCallOpenAI).not.toHaveBeenCalled();
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(5); // classify + EF + debt + amount + timeline
    });
  });

  describe("contradictory intake", () => {
    it("should complete full flow when accepted", async () => {
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(
          createParsedResponse(
            { type: GoalClassification.enum.contradictory },
            "resp_classify",
          ),
        )
        .mockResolvedValueOnce(
          createParsedResponse({ accepted: true }, "resp_contra_extraction"),
        );
      setupEfDebtParsedMocks();
      setupParametersParsedMocks();
      setupPhaseParsedMocks();
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse("resp_contra_intake"));
      setupPhaseLoopMocks();

      const result = await runClarifyStage(
        "I want max returns but can't lose money",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockSendToUser).toHaveBeenCalledTimes(5); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(4); // intake loop + risk + allocation + contribution
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(9); // classify + intake extraction + EF + debt + amount + timeline + 3 extractions
    });

    it("should return null, send rejection message, and stop after intake when rejected", async () => {
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(
          createParsedResponse(
            { type: GoalClassification.enum.contradictory },
            "resp_classify",
          ),
        )
        .mockResolvedValueOnce(
          createParsedResponse({ accepted: false }, "resp_contra_extraction"),
        );
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse("resp_contra_intake"));

      const result = await runClarifyStage(
        "I want max returns but can't lose money",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledTimes(1);
      expect(mockSendToUser).toHaveBeenCalledWith(
        INTAKE_REJECTION_MESSAGES.contradictory,
      );
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(1);
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(2); // classify + intake extraction
    });
  });

  describe("allocation split-unresolved exit", () => {
    it("should return null, send ALLOCATION_EXIT_MESSAGE, and skip contribution when allocation budget is exhausted", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassification.enum.normal }, "resp_classify"),
      );
      setupEfDebtParsedMocks();
      setupParametersParsedMocks();
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse(mockRiskScore, "resp_risk"),
      );

      // Spy on runPhaseLoop to control per-phase outcomes without running the real loop.
      // risk resolves normally; allocation throws PhaseBudgetExhaustedError,
      // which collectAllocation catches and converts to { status: "failure", code: "split_unresolved" }.
      const runPhaseLoopSpy = vi
        .spyOn(clarifyPhase, "runPhaseLoop")
        .mockResolvedValueOnce({ responseId: "resp_risk_loop" })
        .mockRejectedValueOnce(
          new PhaseBudgetExhaustedError("Allocation phase", MAX_ALLOCATION_TOOL_CALLS),
        );

      const result = await runClarifyStage(
        "I want to invest ₪50,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledTimes(6); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q + ALLOCATION_EXIT
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockSendToUser).toHaveBeenNthCalledWith(6, ALLOCATION_EXIT_MESSAGE);
      expect(mockedCallOpenAI).not.toHaveBeenCalled(); // all loops handled by spy
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(6); // classify + EF + debt + amount + timeline + risk

      runPhaseLoopSpy.mockRestore();
    });
  });
});
