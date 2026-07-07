import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackedResponder } from "#pipeline/eval.transcript";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { collectTimeline } from "#pipeline/stages/clarify/timeline/clarify.timeline";
import type { TimelineClassify } from "#pipeline/stages/clarify/timeline/clarify.timeline.types";
import { PipelineStatusEnum, TimelineBucketEnum } from "#schemas/pipeline.schemas";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("collectTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createParsedResponse = <T>(output: T): OpenAIResponse<T> => ({
    id: "resp_test",
    usage: undefined,
    output,
  });

  it("should return completed with timeline when it resolves", async () => {
    mockedCallOpenAIParsed.mockResolvedValueOnce(
      createParsedResponse<TimelineClassify>({
        clarificationNeeded: false,
        clarificationMessage: null,
        timeline: TimelineBucketEnum.enum["3–5 years"],
      }),
    );
    const responder = createTrackedResponder(["5 years"]);

    const result = await collectTimeline(responder);

    expect(result).toEqual({
      status: PipelineStatusEnum.enum.completed,
      timeline: TimelineBucketEnum.enum["3–5 years"],
    });
  });

  it("should return unresolved/timeline when follow-ups are exhausted", async () => {
    const needsClarification: OpenAIResponse<TimelineClassify> = createParsedResponse({
      clarificationNeeded: true,
      clarificationMessage:
        "Could you pick one of these: under 3 years, 3–5 years, 5–10 years, or 10+ years?",
      timeline: null,
    });
    mockedCallOpenAIParsed
      .mockResolvedValueOnce(needsClarification)
      .mockResolvedValueOnce(needsClarification);
    const responder = createTrackedResponder(["I don't know", "really can't say"]);

    const result = await collectTimeline(responder);

    expect(result.status).toBe(PipelineStatusEnum.enum.unresolved);
    if (result.status === PipelineStatusEnum.enum.unresolved) {
      expect(result.reason).toBe(ClarifyUnresolvedReasonEnum.enum.timeline);
    }
  });
});
