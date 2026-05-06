import type { ResponseOutputItem } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runClarifyStage } from "#pipeline/stages/clarify/clarify.stage";
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
  ParametersExtraction,
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

  const mockParametersOutput: ParametersExtraction = {
    amount: 50000,
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
  // Call after the classify (and any intake extraction) mocks, before setupPhaseParsedMocks.
  const setupEfDebtParsedMocks = () => {
    mockWaitForResponse.mockResolvedValueOnce("yes").mockResolvedValueOnce("no");
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(
        createParsedResponse(
          {
            clarificationNeeded: false,
            clarificationMessage: null,
            answer: "yes" as const,
          },
          "resp_ef",
        ),
      )
      .mockResolvedValueOnce(
        createParsedResponse(
          {
            clarificationNeeded: false,
            clarificationMessage: null,
            answer: "no" as const,
          },
          "resp_debt",
        ),
      );
  };

  // Sets up callOpenAIParsed for the four phase extractions in execution order.
  // Always call after classify and ef-debt mocks so the queue order matches execution.
  const setupPhaseParsedMocks = () => {
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(
        createParsedResponse(mockParametersOutput, "resp_parameters"),
      )
      .mockResolvedValueOnce(createParsedResponse(mockRiskScore, "resp_risk"))
      .mockResolvedValueOnce(
        createParsedResponse(mockAllocationOutput, "resp_allocation"),
      )
      .mockResolvedValueOnce(
        createParsedResponse(mockContributionOutput, "resp_contribution"),
      );
  };

  // Sets up callOpenAI loop responses for the four loop phases in execution order.
  // Prepend any intake loop call before invoking this.
  // ef-debt no longer uses a loop — it uses askWithClassify (callOpenAIParsed).
  const setupPhaseLoopMocks = () => {
    mockedCallOpenAI
      .mockResolvedValueOnce(createLoopResponse("resp_parameters_loop"))
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
      setupPhaseParsedMocks();
      setupPhaseLoopMocks();

      const result = await runClarifyStage(
        "I want to invest ₪50,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockWaitForResponse).toHaveBeenCalledTimes(2); // EF + debt questions
      expect(mockSendToUser).toHaveBeenCalledTimes(3); // PROFILE_TRANSITION + EF question + debt question
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(4); // 4 phase loops (no ef-debt loop)
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(7); // classify + EF + debt + 4 extractions
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
      setupPhaseParsedMocks();
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse("resp_oos_intake"));
      setupPhaseLoopMocks();

      const result = await runClarifyStage(
        "I want to buy NVIDIA",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockSendToUser).toHaveBeenCalledTimes(3); // PROFILE_TRANSITION + EF question + debt question
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(5); // intake loop + 4 phase loops
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(8); // classify + intake extraction + EF + debt + 4 extractions
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
      setupPhaseParsedMocks();
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse("resp_unreal_intake"));
      setupPhaseLoopMocks();

      const result = await runClarifyStage(
        "I want to double my money in a month",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockSendToUser).toHaveBeenCalledTimes(3); // PROFILE_TRANSITION + EF question + debt question
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(5); // intake loop + 4 phase loops
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(8); // classify + intake extraction + EF + debt + 4 extractions
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
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse(
          { ...mockParametersOutput, amount: null },
          "resp_parameters",
        ),
      );
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse("resp_parameters_loop"));

      const result = await runClarifyStage(
        "I want to invest some money",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledTimes(4); // PROFILE_TRANSITION + EF + debt + AMOUNT_EXIT
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockSendToUser).toHaveBeenNthCalledWith(4, AMOUNT_EXIT_MESSAGE);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(1); // parameters loop only — risk/allocation/contribution skipped
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(4); // classify + EF + debt + parameters extraction
    });
  });

  describe("short-timeline exit", () => {
    it("should return null, send exit message, and skip risk/allocation/contribution when timeline is under 3 years", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassification.enum.normal }, "resp_classify"),
      );
      setupEfDebtParsedMocks();
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse(
          { ...mockParametersOutput, timeline: TimelineBucket.enum["under 3 years"] },
          "resp_parameters",
        ),
      );
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse("resp_parameters_loop"));

      const result = await runClarifyStage(
        "I want to invest ₪20,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledTimes(4); // PROFILE_TRANSITION + EF question + debt question + SHORT_TIMELINE_EXIT
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockSendToUser).toHaveBeenNthCalledWith(4, SHORT_TIMELINE_EXIT_MESSAGE);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(1); // parameters loop only
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(4); // classify + EF + debt + parameters extraction
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
      setupPhaseParsedMocks();
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse("resp_contra_intake"));
      setupPhaseLoopMocks();

      const result = await runClarifyStage(
        "I want max returns but can't lose money",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockSendToUser).toHaveBeenCalledTimes(3); // PROFILE_TRANSITION + EF question + debt question
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(5); // intake loop + 4 phase loops
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(8); // classify + intake extraction + EF + debt + 4 extractions
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
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(
          createParsedResponse(mockParametersOutput, "resp_parameters"),
        )
        .mockResolvedValueOnce(createParsedResponse(mockRiskScore, "resp_risk"));

      // Spy on runPhaseLoop to control per-phase outcomes without running the real loop.
      // parameters + risk resolve normally; allocation throws PhaseBudgetExhaustedError,
      // which collectAllocation catches and converts to { status: "failure", code: "split_unresolved" }.
      const runPhaseLoopSpy = vi
        .spyOn(clarifyPhase, "runPhaseLoop")
        .mockResolvedValueOnce({ responseId: "resp_parameters_loop" })
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
      expect(mockSendToUser).toHaveBeenCalledTimes(4); // PROFILE_TRANSITION + EF + debt + ALLOCATION_EXIT
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockSendToUser).toHaveBeenNthCalledWith(4, ALLOCATION_EXIT_MESSAGE);
      expect(mockedCallOpenAI).not.toHaveBeenCalled(); // all loops handled by spy
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(5); // classify + EF + debt + parameters + risk extractions

      runPhaseLoopSpy.mockRestore();
    });
  });
});
