import type { EasyInputMessage } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackedResponder } from "#pipeline/eval.transcript";
import {
  ConversationBudgetExhaustedError,
  DirectiveKind,
  isConversationBudgetExhaustedError,
  runConversation,
  type InitHandler,
  type TurnHandler,
} from "#pipeline/run-conversation";

describe("runConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return init's Done result without invoking turnHandler", async () => {
    const responder = createTrackedResponder([]);

    const initHandler: InitHandler<string> = async () => ({
      kind: DirectiveKind.Done,
      result: "early-done",
    });
    const turnHandler = vi.fn<TurnHandler<string>>();

    const result = await runConversation({
      initHandler,
      turnHandler,
      budget: 3,
      responder,
    });

    expect(result).toBe("early-done");
    expect(turnHandler).not.toHaveBeenCalled();
    expect(responder.transcript).toEqual([]);
  });

  it("should complete a single-turn conversation and return the handler's result", async () => {
    const responder = createTrackedResponder(["yes"]);

    const initHandler: InitHandler<{ ok: boolean }> = async () => ({
      kind: DirectiveKind.Ask,
      message: "ready?",
    });
    const turnHandler: TurnHandler<{ ok: boolean }> = async (_history, userReply) => ({
      kind: DirectiveKind.Done,
      result: { ok: userReply === "yes" },
    });

    const result = await runConversation({
      initHandler,
      turnHandler,
      budget: 3,
      responder,
    });

    expect(result).toEqual({ ok: true });
    expect(responder.transcript).toEqual([
      { role: "agent", content: "ready?" },
      { role: "user", content: "yes" },
    ]);
  });

  it("should pass history, userReply, and turnsUsed to turnHandler in order", async () => {
    const responder = createTrackedResponder(["reply-1", "reply-2"]);
    const calls: Array<{
      history: ReadonlyArray<EasyInputMessage>;
      userReply: string;
      turnsUsed: number;
    }> = [];

    const initHandler: InitHandler<string> = async () => ({
      kind: DirectiveKind.Ask,
      message: "q1",
    });
    const turnHandler: TurnHandler<string> = async (history, userReply, turnsUsed) => {
      calls.push({ history: [...history], userReply, turnsUsed });

      return turnsUsed === 1
        ? { kind: DirectiveKind.Ask, message: "q2" }
        : { kind: DirectiveKind.Done, result: "ok" };
    };

    await runConversation({ initHandler, turnHandler, budget: 5, responder });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      history: [
        { role: "assistant", content: "q1" },
        { role: "user", content: "reply-1" },
      ],
      userReply: "reply-1",
      turnsUsed: 1,
    });
    expect(calls[1]).toEqual({
      history: [
        { role: "assistant", content: "q1" },
        { role: "user", content: "reply-1" },
        { role: "assistant", content: "q2" },
        { role: "user", content: "reply-2" },
      ],
      userReply: "reply-2",
      turnsUsed: 2,
    });
  });

  it("should invoke turnHandler exactly `budget` times before throwing on the (budget+1)-th reply", async () => {
    const budget = 2;
    const responder = createTrackedResponder(["r1", "r2", "r3"]);

    const initHandler: InitHandler<never> = async () => ({
      kind: DirectiveKind.Ask,
      message: "first?",
    });
    const turnHandler = vi.fn<TurnHandler<never>>(async () => ({
      kind: DirectiveKind.Ask,
      message: "next?",
    }));

    await expect(
      runConversation({ initHandler, turnHandler, budget, responder }),
    ).rejects.toBeInstanceOf(ConversationBudgetExhaustedError);

    expect(turnHandler).toHaveBeenCalledTimes(budget);
  });

  it("should narrow the thrown error via the isConversationBudgetExhaustedError type guard", async () => {
    const responder = createTrackedResponder(["r1"]);

    const initHandler: InitHandler<never> = async () => ({
      kind: DirectiveKind.Ask,
      message: "go?",
    });
    const turnHandler: TurnHandler<never> = async () => ({
      kind: DirectiveKind.Ask,
      message: "again?",
    });

    let caught: unknown;
    try {
      await runConversation({ initHandler, turnHandler, budget: 0, responder });
    } catch (error) {
      caught = error;
    }

    expect(isConversationBudgetExhaustedError(caught)).toBe(true);
    expect(isConversationBudgetExhaustedError(new Error("other"))).toBe(false);
  });
});
