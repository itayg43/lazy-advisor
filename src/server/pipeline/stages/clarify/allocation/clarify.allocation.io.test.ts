import type { EasyInputMessage } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BadGatewaySchemaValidationError } from "#errors";
import { classifyTurn } from "#pipeline/stages/clarify/allocation/clarify.allocation.io";
import { AllocationIntentKindEnum } from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";
import type { AllocationClassifierOutput } from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
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
});
