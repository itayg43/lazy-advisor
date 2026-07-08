// See documentation/TESTING.md § "Single test file when layers are observably equivalent"
// — clarify orchestrator dispatch + stage outcomes are exercised here in one file rather
// than duplicated across stage and orchestrator levels.

import type { ResponseOutputItem } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SYSTEM_ERROR_EXIT_MESSAGE } from "#constants/pipeline.constants";
import * as allocationModule from "#pipeline/stages/clarify/allocation/clarify.allocation";
import type { AllocationClassifierOutput } from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import type { AmountClassify } from "#pipeline/stages/clarify/amount/clarify.amount.types";
import { runClarifyOrchestrator } from "#pipeline/stages/clarify/clarify.orchestrator";
import type { ContributionClassify } from "#pipeline/stages/clarify/contribution/clarify.contribution.types";
import type {
  EmergencyFundClassify,
  DebtClassify,
} from "#pipeline/stages/clarify/ef-debt/clarify.ef-debt";
import type { RiskClassify } from "#pipeline/stages/clarify/risk/clarify.risk.types";
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
import {
  ClarifyUnresolvedReasonEnum,
  GoalClassificationEnum,
} from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { TimelineClassify } from "#pipeline/stages/clarify/timeline/clarify.timeline.types";
import { PipelineStatusEnum, TimelineBucketEnum } from "#schemas/pipeline.schemas";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAI, mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAI: vi.fn(),
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAI: mockedCallOpenAI,
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("runClarifyOrchestrator", () => {
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
      riskTolerance: 3,
    };
    mockWaitForResponse.mockResolvedValueOnce("3");
    mockedCallOpenAIParsed.mockResolvedValueOnce(createParsedResponse(mockRiskClassify));
  };

  // Allocation now uses runConversation: one classifier LLM call per user turn,
  // no extraction call. Happy-path = single "accept" classification on the
  // first user reply. equityPercentage is computed in code (moderate + 10+yr +
  // score 3 → midpoint 65), not returned by the LLM.
  const setupAllocationMocks = () => {
    mockWaitForResponse.mockResolvedValueOnce("ok");
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<AllocationClassifierOutput>({
        kind: "accept",
        proposedEquityPercentage: null,
      }),
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
    equityPercentage: 65,
    bufferPercentage: 35,
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

      const result = await runClarifyOrchestrator(
        "I want to invest ₪50,000",
        mockResponder,
      );

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

      const result = await runClarifyOrchestrator(goal, mockResponder);

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

      const result = await runClarifyOrchestrator(goal, mockResponder);

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

      const result = await runClarifyOrchestrator(
        "I want to invest some money",
        mockResponder,
      );

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

      const result = await runClarifyOrchestrator(
        "I want to invest ₪50,000",
        mockResponder,
      );

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

      const result = await runClarifyOrchestrator(
        "I want to invest ₪20,000",
        mockResponder,
      );

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
        riskTolerance: null,
      });
      mockWaitForResponse
        .mockResolvedValueOnce("hmm")
        .mockResolvedValueOnce("not sure")
        .mockResolvedValueOnce("really don't know");
      mockedCallOpenAIParsed
        .mockResolvedValueOnce(needs)
        .mockResolvedValueOnce(needs)
        .mockResolvedValueOnce(needs);

      const result = await runClarifyOrchestrator(
        "I want to invest ₪50,000",
        mockResponder,
      );

      expect(result).toEqual({
        status: PipelineStatusEnum.enum.unresolved,
        message: RISK_EXIT_MESSAGE,
      });
    });

    it("should return an unresolved result with ALLOCATION_EXIT_MESSAGE when allocation is unresolved", async () => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ type: GoalClassificationEnum.enum.normal }),
      );
      setupEfDebtMocks();
      setupParametersMocks();
      setupRiskMocks();

      // Spy on collectAllocation directly — the orchestrator's job here is to
      // map `{ status: "unresolved", reason: "allocation" }` to
      // ALLOCATION_EXIT_MESSAGE; the inner exhaustion mechanism (turn budget)
      // is covered by the allocation evals.
      vi.spyOn(allocationModule, "collectAllocation").mockResolvedValueOnce({
        status: PipelineStatusEnum.enum.unresolved,
        reason: ClarifyUnresolvedReasonEnum.enum.allocation,
      });

      const result = await runClarifyOrchestrator(
        "I want to invest ₪50,000",
        mockResponder,
      );

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
          riskTolerance: null,
        }),
      );

      const result = await runClarifyOrchestrator(
        "I want to invest ₪50,000",
        mockResponder,
      );

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
          riskTolerance: null,
        }),
      );

      const result = await runClarifyOrchestrator(
        "I want to invest ₪50,000",
        mockResponder,
      );

      expect(result).toEqual({
        status: PipelineStatusEnum.enum.errored,
        message: SYSTEM_ERROR_EXIT_MESSAGE,
      });
    });
  });
});
