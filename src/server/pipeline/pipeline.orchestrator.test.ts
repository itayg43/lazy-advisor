// See documentation/TESTING.md § "Single test file when layers are observably equivalent"
// — orchestrator dispatch + stage outcomes are exercised here in one file rather than
// duplicated across stage and orchestrator levels.

import type { ResponseOutputItem } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runPipeline } from "#pipeline/pipeline.orchestrator";
import type { ContributionClassify } from "#pipeline/stages/clarify/contribution/clarify.contribution";
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
  INTAKE_REDIRECT_REJECTION_MESSAGES,
  MAX_ALLOCATION_TOOL_CALLS,
  PROFILE_TRANSITION_MESSAGE,
  RISK_EXIT_MESSAGE,
  SHORT_TIMELINE_EXIT_MESSAGE,
  SYSTEM_ERROR_EXIT_MESSAGE,
  TIMELINE_EXIT_MESSAGE,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import * as clarifyPhase from "#pipeline/stages/clarify/shared/clarify.phase";
import { PhaseLoopToolCallsExhaustedError } from "#pipeline/stages/clarify/shared/clarify.phase";
import { GoalClassificationEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { AllocationPhaseOutput } from "#pipeline/stages/clarify/shared/clarify.types";
import { TimelineBucketEnum } from "#schemas/pipeline.schemas";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAI, mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAI: vi.fn(),
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAI: mockedCallOpenAI,
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("runPipeline", () => {
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
      timeline: TimelineBucketEnum.enum["10+ years"],
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
    mockWaitForResponse.mockResolvedValueOnce("yes");
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<ContributionClassify>({
        clarificationNeeded: false,
        clarificationMessage: null,
        answer: "yes",
      }),
    );
  };

  describe("normal goal", () => {
    it("should run all phases and send no exit message on the happy path", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassificationEnum.enum.normal }),
      );
      setupEfDebtMocks();
      setupParametersMocks();
      setupRiskMocks();
      setupAllocationMocks();
      setupContributionMocks();

      await runPipeline(
        "test-session",
        "I want to invest ₪50,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(mockWaitForResponse).toHaveBeenCalledTimes(6); // EF + debt + amount + timeline + risk + contribution
      expect(mockSendToUser).toHaveBeenCalledTimes(7); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q + RISK_Q + CONTRIBUTION_Q
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      // No terminal message — every phase completed
      const sentMessages = mockSendToUser.mock.calls.map((c) => c[0]);
      expect(sentMessages).not.toContain(AMOUNT_EXIT_MESSAGE);
      expect(sentMessages).not.toContain(TIMELINE_EXIT_MESSAGE);
      expect(sentMessages).not.toContain(SHORT_TIMELINE_EXIT_MESSAGE);
      expect(sentMessages).not.toContain(RISK_EXIT_MESSAGE);
      expect(sentMessages).not.toContain(ALLOCATION_EXIT_MESSAGE);
      expect(sentMessages).not.toContain(SYSTEM_ERROR_EXIT_MESSAGE);
      // UserProfileSchema.parse() in the stage validates the assembled profile —
      // a regression in the spread would throw a ZodError and fail this test.
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(1); // allocation loop only; contribution uses askWithClassify
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(8); // classify + EF + debt + amount + timeline + risk + allocation extraction + contribution classify
    });
  });

  describe.each([
    {
      type: GoalClassificationEnum.enum.out_of_scope,
      goal: "I want to buy NVIDIA",
    },
    {
      type: GoalClassificationEnum.enum.unrealistic,
      goal: "I want to double my money in a month",
    },
    {
      type: GoalClassificationEnum.enum.contradictory,
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

      await runPipeline("test-session", goal, mockSendToUser, mockWaitForResponse);

      expect(mockSendToUser).toHaveBeenCalledTimes(7); // PROFILE_TRANSITION + EF_Q + debt_Q + amount_Q + timeline_Q + RISK_Q + CONTRIBUTION_Q
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(2); // intake loop + allocation; contribution uses askWithClassify
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(9); // classify + intake extraction + EF + debt + amount + timeline + risk + allocation extraction + contribution classify
    });

    it("should send rejection message and stop after intake when rejected", async () => {
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(createParsedResponse({ type }))
        .mockResolvedValueOnce(createParsedResponse({ accepted: false }));
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse());

      await runPipeline("test-session", goal, mockSendToUser, mockWaitForResponse);

      expect(mockSendToUser).toHaveBeenCalledTimes(1);
      expect(mockSendToUser).toHaveBeenCalledWith(
        INTAKE_REDIRECT_REJECTION_MESSAGES[type],
      );
      expect(mockedCallOpenAI).toHaveBeenCalledTimes(1);
      expect(mockedCallOpenAIParsed).toHaveBeenCalledTimes(2); // classify + intake extraction
    });
  });

  describe("clarify terminations", () => {
    it("should send AMOUNT_EXIT_MESSAGE and skip risk/allocation/contribution when amount is unresolved", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassificationEnum.enum.normal }),
      );
      setupEfDebtMocks();
      mockWaitForResponse
        .mockResolvedValueOnce("I don't know")
        .mockResolvedValueOnce("still not sure");
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(
          createParsedResponse<AmountClassify>({
            clarificationNeeded: true,
            clarificationMessage: "Please share a specific number.",
            amount: null,
          }),
        )
        .mockResolvedValueOnce(
          createParsedResponse<AmountClassify>({
            clarificationNeeded: true,
            clarificationMessage: "Please share a specific number.",
            amount: null,
          }),
        );

      await runPipeline(
        "test-session",
        "I want to invest some money",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(mockSendToUser).toHaveBeenLastCalledWith(AMOUNT_EXIT_MESSAGE);
      expect(mockedCallOpenAI).not.toHaveBeenCalled();
    });

    it("should send TIMELINE_EXIT_MESSAGE and skip risk/allocation/contribution when timeline is unresolved", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassificationEnum.enum.normal }),
      );
      setupEfDebtMocks();
      mockWaitForResponse
        .mockResolvedValueOnce("₪50,000")
        .mockResolvedValueOnce("I don't know")
        .mockResolvedValueOnce("really can't say");
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(
          createParsedResponse<AmountClassify>({
            clarificationNeeded: false,
            clarificationMessage: null,
            amount: 50000,
          }),
        )
        .mockResolvedValueOnce(
          createParsedResponse<TimelineClassify>({
            clarificationNeeded: true,
            clarificationMessage: "Please pick one.",
            timeline: null,
          }),
        )
        .mockResolvedValueOnce(
          createParsedResponse<TimelineClassify>({
            clarificationNeeded: true,
            clarificationMessage: "Please pick one.",
            timeline: null,
          }),
        );

      await runPipeline(
        "test-session",
        "I want to invest ₪50,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(mockSendToUser).toHaveBeenLastCalledWith(TIMELINE_EXIT_MESSAGE);
      expect(mockedCallOpenAI).not.toHaveBeenCalled();
    });

    it("should send SHORT_TIMELINE_EXIT_MESSAGE when timeline is under 3 years", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassificationEnum.enum.normal }),
      );
      setupEfDebtMocks();
      mockWaitForResponse
        .mockResolvedValueOnce("₪20,000")
        .mockResolvedValueOnce("under 3 years");
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(
          createParsedResponse<AmountClassify>({
            clarificationNeeded: false,
            clarificationMessage: null,
            amount: 20000,
          }),
        )
        .mockResolvedValueOnce(
          createParsedResponse<TimelineClassify>({
            clarificationNeeded: false,
            clarificationMessage: null,
            timeline: TimelineBucketEnum.enum["under 3 years"],
          }),
        );

      await runPipeline(
        "test-session",
        "I want to invest ₪20,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(mockSendToUser).toHaveBeenLastCalledWith(SHORT_TIMELINE_EXIT_MESSAGE);
      expect(mockedCallOpenAI).not.toHaveBeenCalled();
    });

    it("should send RISK_EXIT_MESSAGE when risk follow-ups are exhausted", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassificationEnum.enum.normal }),
      );
      setupEfDebtMocks();
      setupParametersMocks();
      const needs: OpenAIResponse<RiskClassify> = createParsedResponse({
        clarificationNeeded: true,
        clarificationMessage: "Please pick a whole number between 1 and 5.",
        selfRatingScore: null,
      });
      mockWaitForResponse
        .mockResolvedValueOnce("hmm")
        .mockResolvedValueOnce("not sure")
        .mockResolvedValueOnce("really don't know");
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(needs)
        .mockResolvedValueOnce(needs)
        .mockResolvedValueOnce(needs);

      await runPipeline(
        "test-session",
        "I want to invest ₪50,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(mockSendToUser).toHaveBeenLastCalledWith(RISK_EXIT_MESSAGE);
      expect(mockedCallOpenAI).not.toHaveBeenCalled();
    });

    it("should send ALLOCATION_EXIT_MESSAGE when allocation tool calls are exhausted", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassificationEnum.enum.normal }),
      );
      setupEfDebtMocks();
      setupParametersMocks();
      setupRiskMocks();

      // Spy on runPhaseLoop so allocation throws PhaseLoopToolCallsExhaustedError,
      // which collectAllocation converts to { status: "unresolved", reason: "allocation" }.
      vi.spyOn(clarifyPhase, "runPhaseLoop").mockRejectedValueOnce(
        new PhaseLoopToolCallsExhaustedError(
          "Allocation phase",
          MAX_ALLOCATION_TOOL_CALLS,
        ),
      );

      await runPipeline(
        "test-session",
        "I want to invest ₪50,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(mockSendToUser).toHaveBeenLastCalledWith(ALLOCATION_EXIT_MESSAGE);
      expect(mockedCallOpenAI).not.toHaveBeenCalled(); // allocation loop handled by spy
    });

    // System-error dispatch wiring — one canonical case (risk) is sufficient at the
    // orchestrator layer; per-phase errored-result coverage lives in phase tests.
    it("should send SYSTEM_ERROR_EXIT_MESSAGE when risk classify output is invalid", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassificationEnum.enum.normal }),
      );
      setupEfDebtMocks();
      setupParametersMocks();
      mockWaitForResponse.mockResolvedValueOnce("I don't know");
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse<RiskClassify>({
          clarificationNeeded: false,
          clarificationMessage: null,
          selfRatingScore: null,
        }),
      );

      await runPipeline(
        "test-session",
        "I want to invest ₪50,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(mockSendToUser).toHaveBeenLastCalledWith(SYSTEM_ERROR_EXIT_MESSAGE);
    });

    it("should send SYSTEM_ERROR_EXIT_MESSAGE when risk classify message is missing mid-loop", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassificationEnum.enum.normal }),
      );
      setupEfDebtMocks();
      setupParametersMocks();
      mockWaitForResponse.mockResolvedValueOnce("I don't know");
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse<RiskClassify>({
          clarificationNeeded: true,
          clarificationMessage: null,
          selfRatingScore: null,
        }),
      );

      await runPipeline(
        "test-session",
        "I want to invest ₪50,000",
        mockSendToUser,
        mockWaitForResponse,
      );

      expect(mockSendToUser).toHaveBeenLastCalledWith(SYSTEM_ERROR_EXIT_MESSAGE);
    });
  });
});
