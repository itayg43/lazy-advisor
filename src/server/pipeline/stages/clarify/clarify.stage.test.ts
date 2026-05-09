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
import type { RiskClassify } from "#pipeline/stages/clarify/risk/clarify.risk";
import {
  ALLOCATION_EXIT_MESSAGE,
  AMOUNT_EXIT_MESSAGE,
  INTAKE_REJECTION_MESSAGES,
  MAX_ALLOCATION_TOOL_CALLS,
  PROFILE_TRANSITION_MESSAGE,
  RISK_EXIT_MESSAGE,
  SHORT_TIMELINE_EXIT_MESSAGE,
  TIMELINE_EXIT_MESSAGE,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import * as clarifyPhase from "#pipeline/stages/clarify/shared/clarify.phase";
import { PhaseBudgetExhaustedError } from "#pipeline/stages/clarify/shared/clarify.phase";
import { GoalClassification } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  AllocationPhaseOutput,
  ContributionPhaseOutput,
} from "#pipeline/stages/clarify/shared/clarify.types";
import { RiskTolerance, TimelineBucket } from "#schemas/pipeline.schemas";
import type { OpenAIResponse } from "#services/openai";
import type { UserProfile } from "#types/pipeline.types";

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
    vi.restoreAllMocks();
  });

  const createLoopResponse = (): OpenAIResponse<ResponseOutputItem[]> => ({
    id: "resp_loop",
    usage: undefined,
    output: [
      {
        type: "message",
        id: "msg_loop",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: "Done.", annotations: [] }],
      },
    ],
  });

  const createParsedResponse = <T>(output: T): OpenAIResponse<T> => ({
    id: "resp_parsed",
    usage: undefined,
    output,
  });

  const expectedProfile: UserProfile = {
    amount: 50000,
    timeline: TimelineBucket.enum["10+ years"],
    riskTolerance: RiskTolerance.enum.moderate,
    equityPercentage: 60,
    bufferPercentage: 40,
    plansToContribute: true,
  };

  const setupEfDebtMocks = () => {
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
    mockWaitForResponse.mockResolvedValueOnce("yes").mockResolvedValueOnce("no");
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(createParsedResponse(mockEfOutput))
      .mockResolvedValueOnce(createParsedResponse(mockDebtOutput));
  };

  const setupParametersMocks = () => {
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
    mockWaitForResponse
      .mockResolvedValueOnce("₪50,000")
      .mockResolvedValueOnce("10+ years");
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(createParsedResponse(mockAmountOutput))
      .mockResolvedValueOnce(createParsedResponse(mockTimelineOutput));
  };

  const setupRiskMocks = () => {
    const mockRiskClassify: RiskClassify = {
      clarificationNeeded: false,
      clarificationMessage: null,
      selfRatingScore: 3,
    };
    mockWaitForResponse.mockResolvedValueOnce("3");
    mockedCallOpenAIParsed.mockResolvedValueOnce(createParsedResponse(mockRiskClassify));
  };

  const setupAllocationMocks = () => {
    const mockAllocationOutput: AllocationPhaseOutput = {
      equityPercentage: 60,
      bufferPercentage: 40,
    };
    mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse());
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse(mockAllocationOutput),
    );
  };

  const setupContributionMocks = () => {
    const mockContributionOutput: ContributionPhaseOutput = { plansToContribute: true };
    mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse());
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse(mockContributionOutput),
    );
  };

  describe("normal goal", () => {
    it("should return assembled UserProfile and run all phases", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassification.enum.normal }),
      );
      setupEfDebtMocks();
      setupParametersMocks();
      setupRiskMocks();
      setupAllocationMocks();
      setupContributionMocks();

      const result = await runClarifyStage(
        "test-session",
        "I want to invest ₪50,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockWaitForResponse).toHaveBeenCalledTimes(5); // EF + debt + amount + timeline + risk
      expect(mockSendToUser).toHaveBeenCalledTimes(6); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q + RISK_Q
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(2); // allocation + contribution loops (risk uses askWithClassify)
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(8); // classify + EF + debt + amount + timeline + risk classify + allocation + contribution
    });
  });

  describe.each([
    { type: GoalClassification.enum.out_of_scope, goal: "I want to buy NVIDIA" },
    {
      type: GoalClassification.enum.unrealistic,
      goal: "I want to double my money in a month",
    },
    {
      type: GoalClassification.enum.contradictory,
      goal: "I want max returns but can't lose money",
    },
  ])("$type intake", ({ type, goal }) => {
    it("should complete full flow when accepted", async () => {
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(createParsedResponse({ type }))
        .mockResolvedValueOnce(createParsedResponse({ accepted: true }));
      setupEfDebtMocks();
      setupParametersMocks();
      setupRiskMocks();
      // intake and allocation both use callOpenAI; intake runs first in the pipeline so its mock is queued here
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse());
      setupAllocationMocks();
      setupContributionMocks();

      const result = await runClarifyStage(
        "test-session",
        goal,
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toMatchObject(expectedProfile);
      expect(mockSendToUser).toHaveBeenCalledTimes(6); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q + RISK_Q
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(3); // intake loop + allocation + contribution (risk uses askWithClassify)
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(9); // classify + intake extraction + EF + debt + amount + timeline + risk classify + allocation + contribution
    });

    it("should return null, send rejection message, and stop after intake when rejected", async () => {
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(createParsedResponse({ type }))
        .mockResolvedValueOnce(createParsedResponse({ accepted: false }));
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse());

      const result = await runClarifyStage(
        "test-session",
        goal,
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(result).toBeNull();
      expect(mockSendToUser).toHaveBeenCalledTimes(1);
      expect(mockSendToUser).toHaveBeenCalledWith(INTAKE_REJECTION_MESSAGES[type]);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(1);
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(2); // classify + intake extraction
    });
  });

  describe("early exits", () => {
    describe("amount-missing exit", () => {
      it("should return null, send AMOUNT_EXIT_MESSAGE, and skip risk/allocation/contribution when amount cannot be collected", async () => {
        mockedCallOpenAIParsed.mockResolvedValueOnce(
          createParsedResponse({ type: GoalClassification.enum.normal }),
        );
        setupEfDebtMocks();
        mockWaitForResponse.mockResolvedValueOnce("I don't know");
        mockedCallOpenAIParsed.mockResolvedValueOnce(
          createParsedResponse({
            clarificationNeeded: false,
            clarificationMessage: null,
            amount: null,
          }),
        );

        const result = await runClarifyStage(
          "test-session",
          "I want to invest some money",
          mockSendToUser,
          mockWaitForResponse,
        );

        expect(result).toBeNull();
        expect(mockSendToUser).toHaveBeenCalledTimes(5); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + AMOUNT_EXIT
        expect(mockSendToUser).toHaveBeenLastCalledWith(AMOUNT_EXIT_MESSAGE);
        expect(mockedCallOpenAI).not.toHaveBeenCalled();
        expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(4); // classify + EF + debt + amount
      });
    });

    describe("timeline-missing exit", () => {
      it("should return null, send TIMELINE_EXIT_MESSAGE, and skip risk/allocation/contribution when timeline cannot be collected", async () => {
        mockedCallOpenAIParsed.mockResolvedValueOnce(
          createParsedResponse({ type: GoalClassification.enum.normal }),
        );
        setupEfDebtMocks();
        mockWaitForResponse
          .mockResolvedValueOnce("₪50,000")
          .mockResolvedValueOnce("I don't know");
        mockedCallOpenAIParsed
          .mockResolvedValueOnce(
            createParsedResponse({
              clarificationNeeded: false,
              clarificationMessage: null,
              amount: 50000,
            }),
          )
          .mockResolvedValueOnce(
            createParsedResponse({
              clarificationNeeded: false,
              clarificationMessage: null,
              timeline: null,
            }),
          );

        const result = await runClarifyStage(
          "test-session",
          "I want to invest ₪50,000",
          mockSendToUser,
          mockWaitForResponse,
        );

        expect(result).toBeNull();
        expect(mockSendToUser).toHaveBeenCalledTimes(6); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q + TIMELINE_EXIT
        expect(mockSendToUser).toHaveBeenLastCalledWith(TIMELINE_EXIT_MESSAGE);
        expect(mockedCallOpenAI).not.toHaveBeenCalled();
        expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(5); // classify + EF + debt + amount + timeline
      });
    });

    describe("short-timeline exit", () => {
      it("should return null, send SHORT_TIMELINE_EXIT_MESSAGE, and skip risk/allocation/contribution when timeline is under 3 years", async () => {
        mockedCallOpenAIParsed.mockResolvedValueOnce(
          createParsedResponse({ type: GoalClassification.enum.normal }),
        );
        setupEfDebtMocks();
        mockWaitForResponse
          .mockResolvedValueOnce("₪20,000")
          .mockResolvedValueOnce("under 3 years");
        mockedCallOpenAIParsed
          .mockResolvedValueOnce(
            createParsedResponse({
              clarificationNeeded: false,
              clarificationMessage: null,
              amount: 20000,
            }),
          )
          .mockResolvedValueOnce(
            createParsedResponse({
              clarificationNeeded: false,
              clarificationMessage: null,
              timeline: TimelineBucket.enum["under 3 years"],
            }),
          );

        const result = await runClarifyStage(
          "test-session",
          "I want to invest ₪20,000",
          mockSendToUser,
          mockWaitForResponse,
        );

        expect(result).toBeNull();
        expect(mockSendToUser).toHaveBeenCalledTimes(6); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q + SHORT_TIMELINE_EXIT
        expect(mockSendToUser).toHaveBeenLastCalledWith(SHORT_TIMELINE_EXIT_MESSAGE);
        expect(mockedCallOpenAI).not.toHaveBeenCalled();
        expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(5); // classify + EF + debt + amount + timeline
      });
    });

    describe("risk-missing exit", () => {
      it("should return null, send RISK_EXIT_MESSAGE, and skip allocation/contribution when risk cannot be collected", async () => {
        mockedCallOpenAIParsed.mockResolvedValueOnce(
          createParsedResponse({ type: GoalClassification.enum.normal }),
        );
        setupEfDebtMocks();
        setupParametersMocks();
        mockWaitForResponse.mockResolvedValueOnce("I don't know");
        mockedCallOpenAIParsed.mockResolvedValueOnce(
          createParsedResponse({
            clarificationNeeded: false,
            clarificationMessage: null,
            selfRatingScore: null,
          }),
        );

        const result = await runClarifyStage(
          "test-session",
          "I want to invest ₪50,000",
          mockSendToUser,
          mockWaitForResponse,
        );

        expect(result).toBeNull();
        expect(mockSendToUser).toHaveBeenCalledTimes(7); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q + RISK_Q + RISK_EXIT
        expect(mockSendToUser).toHaveBeenLastCalledWith(RISK_EXIT_MESSAGE);
        expect(mockedCallOpenAI).not.toHaveBeenCalled();
        expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(6); // classify + EF + debt + amount + timeline + risk
      });
    });

    describe("allocation split-unresolved exit", () => {
      it("should return null, send ALLOCATION_EXIT_MESSAGE, and skip contribution when allocation budget is exhausted", async () => {
        mockedCallOpenAIParsed.mockResolvedValueOnce(
          createParsedResponse({ type: GoalClassification.enum.normal }),
        );
        setupEfDebtMocks();
        setupParametersMocks();
        setupRiskMocks();

        // Spy on runPhaseLoop so allocation throws PhaseBudgetExhaustedError,
        // which collectAllocation converts to { status: "failure", reason: "split_unresolved" }.
        vi.spyOn(clarifyPhase, "runPhaseLoop").mockRejectedValueOnce(
          new PhaseBudgetExhaustedError("Allocation phase", MAX_ALLOCATION_TOOL_CALLS),
        );

        const result = await runClarifyStage(
          "test-session",
          "I want to invest ₪50,000",
          mockSendToUser,
          mockWaitForResponse,
        );

        expect(result).toBeNull();
        expect(mockSendToUser).toHaveBeenCalledTimes(7); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q + RISK_Q + ALLOCATION_EXIT
        expect(mockSendToUser).toHaveBeenLastCalledWith(ALLOCATION_EXIT_MESSAGE);
        expect(mockedCallOpenAI).not.toHaveBeenCalled(); // allocation loop handled by spy
        expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(6); // classify + EF + debt + amount + timeline + risk classify
      });
    });
  });
});
