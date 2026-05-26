// T4 demo — allocation phase reimplemented on top of `runConversation`.
// Mirrors the signature of the real collectAllocation
// (src/server/pipeline/stages/clarify/allocation/clarify.allocation.ts) so it can
// be swapped in for testing, but the LLM-driven helpers are stubbed:
// `classifyIntent` is a regex over the reply, `composeCounterResponse` is a
// hardcoded template. The goal is to exercise the runConversation loop +
// closure-state pattern end-to-end, not to validate real prompts.

import type { EasyInputMessage } from "openai/resources/responses/responses";

import {
  DirectiveKind,
  runConversation,
  type InitHandler,
  type TurnHandler,
} from "#pipeline/run-conversation";
import {
  type AllocationCell,
  ALLOCATION_ANCHOR_DATA,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.constants";
import type {
  AllocationPhaseInput,
  AllocationPhaseResult,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.types";
import type { RiskSelfRatingScore } from "#pipeline/stages/clarify/risk/clarify.risk.types";
import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const MAX_TURNS = 5;

// Duplicated locally to keep the demo self-contained and avoid pulling in the
// legacy runPhaseLoop-based module.
const pickEquityPercentage = (
  cell: AllocationCell,
  score: RiskSelfRatingScore,
): number => {
  switch (score) {
    case 1:
    case 4:
      return cell.min + 2;
    case 2:
    case 5:
      return cell.max - 2;
    case 3:
      return (cell.min + cell.max) / 2;
  }
};

type Intent =
  | { kind: "accept" }
  | { kind: "counter"; proposedEquity: number }
  | { kind: "unknown" };

// Stub — real implementation would call an LLM classifier with a schema.
const classifyIntent = async (
  _history: ReadonlyArray<EasyInputMessage>,
  reply: string,
): Promise<Intent> => {
  const counterMatch = reply.match(/(\d{1,3})\s*\/\s*\d{1,3}/);
  if (counterMatch) {
    const proposedEquity = Number(counterMatch[1]);
    return { kind: "counter", proposedEquity };
  }
  if (/\b(yes|sure|ok|okay|agree|accept|fine|sounds good|confirmed?)\b/i.test(reply)) {
    return { kind: "accept" };
  }
  return { kind: "unknown" };
};

// Stub — real implementation would call an LLM composer.
const composeCounterResponse = async ({
  counters,
  hasShownDrawdownFraming,
}: {
  counters: ReadonlyArray<number>;
  hasShownDrawdownFraming: boolean;
}): Promise<string> => {
  const latest = counters.at(-1);
  if (!hasShownDrawdownFraming) {
    return `You proposed ${latest}% equity — that's more aggressive. Quick sanity check: a 40%+ drawdown is plausible. Still sure?`;
  }
  return `Got it, you're at ${latest}% (counter #${counters.length}). Want to lock it in?`;
};

export const collectAllocation = async (
  { timeline, riskTolerance, riskSelfRatingScore }: AllocationPhaseInput,
  responder: Responder,
): Promise<AllocationPhaseResult> => {
  const cell = ALLOCATION_ANCHOR_DATA[riskTolerance][timeline];
  const proposedEquity = pickEquityPercentage(cell, riskSelfRatingScore);
  const proposedBuffer = 100 - proposedEquity;

  const counters: number[] = [];
  let hasShownDrawdownFraming = false;
  let turnCount = 0;

  const initHandler: InitHandler<AllocationPhaseResult> = async () => ({
    kind: DirectiveKind.Ask,
    message: `I propose ${proposedEquity}% equity / ${proposedBuffer}% buffer.`,
  });

  const turnHandler: TurnHandler<AllocationPhaseResult> = async (history, userResponse) => {
    turnCount++;
    const intent = await classifyIntent(history, userResponse);

    if (intent.kind === "accept") {
      return {
        kind: DirectiveKind.Done,
        result: {
          status: PipelineStatusEnum.enum.completed,
          equityPercentage: proposedEquity,
          bufferPercentage: proposedBuffer,
        },
      };
    }

    if (turnCount >= MAX_TURNS) {
      return {
        kind: DirectiveKind.Done,
        result: {
          status: PipelineStatusEnum.enum.unresolved,
          reason: ClarifyUnresolvedReasonEnum.enum.allocation,
        },
      };
    }

    if (intent.kind === "counter") {
      counters.push(intent.proposedEquity);
      const message = await composeCounterResponse({
        counters,
        hasShownDrawdownFraming,
      });
      hasShownDrawdownFraming = true;
      return { kind: DirectiveKind.Ask, message };
    }

    // unknown — re-prompt without mutating state.
    return {
      kind: DirectiveKind.Ask,
      message:
        "I didn't catch that. Reply 'yes' to accept, or a split like '80/20' to counter.",
    };
  };

  return runConversation({ initHandler, turnHandler, responder });
};
