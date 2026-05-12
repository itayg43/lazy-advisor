// See documentation/TESTING.md § "Single test file when layers are observably equivalent"
// — clarify orchestrator dispatch + stage outcomes are exercised here in one file rather
// than duplicated across stage and orchestrator levels.

import type { ResponseOutputItem } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SYSTEM_ERROR_EXIT_MESSAGE } from "#pipeline/pipeline.constants";
import { MAX_ALLOCATION_TOOL_CALLS } from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import type { AllocationPhaseOutput } from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import { runClarify } from "#pipeline/stages/clarify/clarify.orchestrator";
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
  PROFILE_TRANSITION_MESSAGE,
  RISK_EXIT_MESSAGE,
  SHORT_TIMELINE_BUCKET,
  SHORT_TIMELINE_EXIT_MESSAGE,
  TIMELINE_EXIT_MESSAGE,
} from "#pipeline/stages/clarify/shared/clarify.constants";
import * as clarifyPhase from "#pipeline/stages/clarify/shared/clarify.phase";
import { PhaseLoopToolCallsExhaustedError } from "#pipeline/stages/clarify/shared/clarify.phase";
import { GoalClassificationEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import {
  PipelineStatusEnum,
  RiskToleranceEnum,
  TimelineBucketEnum,
} from "#schemas/pipeline.schemas";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAI, mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAI: vi.fn(),
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAI: mockedCallOpenAI,
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("runClarify", () => {
  const mockSendToUser = vi.fn();
  const mockWaitForResponse = vi.fn<() => Promise<string>>();
  const mockResponder = {
    sendToUser: mockSendToUser,
    waitForResponse: mockWaitForResponse,
  };

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

  const expectedHappyPathProfile = {
    amount: 50000,
    timeline: TimelineBucketEnum.enum["10+ years"],
    riskTolerance: RiskToleranceEnum.enum.moderate,
    equityPercentage: 60,
    bufferPercentage: 40,
    plansToContribute: true,
  };

  describe("normal goal", () => {
    it("should run all phases and return a completed result with the assembled profile on the happy path", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassificationEnum.enum.normal }),
      );
      setupEfDebtMocks();
      setupParametersMocks();
      setupRiskMocks();
      setupAllocationMocks();
      setupContributionMocks();

      const result = await runClarify("I want to invest ₪50,000", mockResponder);

      expect(result).toEqual({
        status: PipelineStatusEnum.enum.completed,
        profile: expectedHappyPathProfile,
      });
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
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
    it("should return a completed result with the assembled profile when accepted", async () => {
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

      const result = await runClarify(goal, mockResponder);

      expect(result).toEqual({
        status: PipelineStatusEnum.enum.completed,
        profile: expectedHappyPathProfile,
      });
      expect(mockSendToUser).toHaveBeenNthCalledWith(1, PROFILE_TRANSITION_MESSAGE);
    });

    it("should return a halted result with the rejection message when rejected", async () => {
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(createParsedResponse({ type }))
        .mockResolvedValueOnce(createParsedResponse({ accepted: false }));
      mockedCallOpenAI.mockResolvedValueOnce(createLoopResponse());

      const result = await runClarify(goal, mockResponder);

      expect(result).toEqual({
        status: PipelineStatusEnum.enum.halted,
        message: INTAKE_REDIRECT_REJECTION_MESSAGES[type],
      });
    });
  });

  describe("clarify terminations", () => {
    it("should return an unresolved result with AMOUNT_EXIT_MESSAGE when amount is unresolved", async () => {
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

      const result = await runClarify("I want to invest some money", mockResponder);

      expect(result).toEqual({
        status: PipelineStatusEnum.enum.unresolved,
        message: AMOUNT_EXIT_MESSAGE,
      });
    });

    it("should return an unresolved result with TIMELINE_EXIT_MESSAGE when timeline is unresolved", async () => {
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

      const result = await runClarify("I want to invest ₪50,000", mockResponder);

      expect(result).toEqual({
        status: PipelineStatusEnum.enum.unresolved,
        message: TIMELINE_EXIT_MESSAGE,
      });
    });

    it("should return a halted result with SHORT_TIMELINE_EXIT_MESSAGE when timeline is under 3 years", async () => {
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
            timeline: SHORT_TIMELINE_BUCKET,
          }),
        );

      const result = await runClarify("I want to invest ₪20,000", mockResponder);

      expect(result).toEqual({
        status: PipelineStatusEnum.enum.halted,
        message: SHORT_TIMELINE_EXIT_MESSAGE,
      });
    });

    it("should return an unresolved result with RISK_EXIT_MESSAGE when risk follow-ups are exhausted", async () => {
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

      const result = await runClarify("I want to invest ₪50,000", mockResponder);

      expect(result).toEqual({
        status: PipelineStatusEnum.enum.unresolved,
        message: RISK_EXIT_MESSAGE,
      });
    });

    it("should return an unresolved result with ALLOCATION_EXIT_MESSAGE when allocation tool calls are exhausted", async () => {
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

      const result = await runClarify("I want to invest ₪50,000", mockResponder);

      expect(result).toEqual({
        status: PipelineStatusEnum.enum.unresolved,
        message: ALLOCATION_EXIT_MESSAGE,
      });
    });

    // System-error resolution wiring — one canonical case (risk) is sufficient at the
    // orchestrator layer; per-phase errored-result coverage lives in phase tests.
    it("should return an errored result with SYSTEM_ERROR_EXIT_MESSAGE when risk classify output is invalid", async () => {
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

      const result = await runClarify("I want to invest ₪50,000", mockResponder);

      expect(result).toEqual({
        status: PipelineStatusEnum.enum.errored,
        message: SYSTEM_ERROR_EXIT_MESSAGE,
      });
    });

    it("should return an errored result with SYSTEM_ERROR_EXIT_MESSAGE when risk classify message is missing mid-loop", async () => {
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

      const result = await runClarify("I want to invest ₪50,000", mockResponder);

      expect(result).toEqual({
        status: PipelineStatusEnum.enum.errored,
        message: SYSTEM_ERROR_EXIT_MESSAGE,
      });
    });
  });
});
