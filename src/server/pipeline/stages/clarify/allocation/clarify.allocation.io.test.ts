import type { EasyInputMessage } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BadGatewaySchemaValidationError } from "#errors";
import {
  classifyTurn,
  composeCounterReply,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.io";
import {
  AllocationCounterBranchKindEnum,
  AllocationExtremeCounterDirectionEnum,
  AllocationIntentKindEnum,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type {
  AllocationClassifierOutput,
  AllocationCounterBranch,
  AllocationProposalContext,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import { TimelineBucketEnum } from "#schemas/pipeline.schemas";
import type { OpenAIResponse } from "#services/openai";

const { mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#services/openai", () => ({
  callOpenAIParsed: mockedCallOpenAIParsed,
}));

describe("clarifyAllocationIO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createParsedResponse = <T>(output: T): OpenAIResponse<T> => ({
    id: "resp_test",
    usage: undefined,
    output,
  });

  // The classifier reads the running conversation; classifyTurn forwards it
  // verbatim, so the user reply only documents the intent the mocked output
  // stands in for — the mocked classification, not the history, drives the case.
  const proposalThenReply = (userReply: string): EasyInputMessage[] => [
    {
      role: "assistant",
      content:
        "I'd propose ₪65,000 in stock ETFs and ₪35,000 in a buffer — roughly 65/35.",
    },
    { role: "user", content: userReply },
  ];

  describe("classifyTurn", () => {
    it("should resolve a counter classification to an intent carrying the proposed percentage", async () => {
      const output: AllocationClassifierOutput = {
        kind: AllocationIntentKindEnum.enum.counter,
        proposedEquityPercentage: 60,
      };
      mockedCallOpenAIParsed.mockResolvedValueOnce(createParsedResponse(output));

      const intent = await classifyTurn(proposalThenReply("I want 60%"));

      expect(intent).toEqual({
        kind: AllocationIntentKindEnum.enum.counter,
        proposedEquityPercentage: 60,
      });
    });

    it("should drop the null percentage when resolving a non-counter classification", async () => {
      const output: AllocationClassifierOutput = {
        kind: AllocationIntentKindEnum.enum.accept,
        proposedEquityPercentage: null,
      };
      mockedCallOpenAIParsed.mockResolvedValueOnce(createParsedResponse(output));

      const intent = await classifyTurn(proposalThenReply("sounds good"));

      expect(intent).toEqual({ kind: AllocationIntentKindEnum.enum.accept });
    });

    it("should throw when a counter classification has no proposed percentage", async () => {
      // Model disobedience: the prompt routes a numberless "more in stocks" to
      // unknown, so counter + null violates the resolved-intent contract.
      const output: AllocationClassifierOutput = {
        kind: AllocationIntentKindEnum.enum.counter,
        proposedEquityPercentage: null,
      };
      mockedCallOpenAIParsed.mockResolvedValueOnce(createParsedResponse(output));

      await expect(classifyTurn(proposalThenReply("more in stocks"))).rejects.toThrow(
        BadGatewaySchemaValidationError,
      );
    });
  });

  describe("composeCounterReply", () => {
    const { extreme, "compound-impact": compoundImpact } =
      AllocationCounterBranchKindEnum.enum;
    const { "too-high": tooHigh, "too-low": tooLow } =
      AllocationExtremeCounterDirectionEnum.enum;

    const proposalContext: AllocationProposalContext = {
      amount: 50_000,
      timeline: TimelineBucketEnum.enum["10+ years"],
      suggestedEquityRange: { min: 80, max: 90 },
    };
    const equityPercentages = {
      proposedEquityPercentage: 50,
      previousEquityPercentage: 90,
    };

    // The one transformation composeCounterReply owns is rendering the selected
    // branch into the composer input as `Branch to render: <tag>` — an extreme
    // branch also encoding its direction. (The shekel split/buffer come from lib
    // helpers tested elsewhere.) Which branch gets *selected* is covered by
    // selectCounterBranch in the lib test; this pins how each is *rendered*.
    it.each<{ label: string; branch: AllocationCounterBranch; tag: string }>([
      {
        label: "an extreme too-high branch with its direction",
        branch: { kind: extreme, direction: tooHigh },
        tag: "extreme-too-high",
      },
      {
        label: "an extreme too-low branch with its direction",
        branch: { kind: extreme, direction: tooLow },
        tag: "extreme-too-low",
      },
      {
        label: "a non-extreme branch as its bare kind",
        branch: { kind: compoundImpact },
        tag: "compound-impact",
      },
    ])("should render $label into the composer input", async ({ branch, tag }) => {
      mockedCallOpenAIParsed.mockResolvedValueOnce(
        createParsedResponse({ reply: "Reply." }),
      );

      await composeCounterReply(branch, equityPercentages, proposalContext);

      const [params] = mockedCallOpenAIParsed.mock.calls[0];
      expect((params as { input: string }).input).toContain(`Branch to render: ${tag}`);
    });
  });
});
