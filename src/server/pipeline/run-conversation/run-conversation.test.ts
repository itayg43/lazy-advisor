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
    const turnHandler: TurnHandler<{ ok: boolean }> = async (_history, userResponse) => ({
      kind: DirectiveKind.Done,
      result: { ok: userResponse === "yes" },
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

  it("should pass history and userResponse to turnHandler in order", async () => {
    const responder = createTrackedResponder(["reply-1", "reply-2"]);
    const calls: Array<{
      history: ReadonlyArray<EasyInputMessage>;
      userResponse: string;
    }> = [];

    const initHandler: InitHandler<string> = async () => ({
      kind: DirectiveKind.Ask,
      message: "q1",
    });
    let callIndex = 0;
    const turnHandler: TurnHandler<string> = async (history, userResponse) => {
      callIndex++;
      calls.push({ history: [...history], userResponse });

      return callIndex === 1
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
      userResponse: "reply-1",
    });
    expect(calls[1]).toEqual({
      history: [
        { role: "assistant", content: "q1" },
        { role: "user", content: "reply-1" },
        { role: "assistant", content: "q2" },
        { role: "user", content: "reply-2" },
      ],
      userResponse: "reply-2",
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

  it("should send Done.message to the user before returning", async () => {
    const responder = createTrackedResponder(["ok"]);

    const initHandler: InitHandler<string> = async () => ({
      kind: DirectiveKind.Ask,
      message: "ready?",
    });
    const turnHandler: TurnHandler<string> = async () => ({
      kind: DirectiveKind.Done,
      message: "Locked in 70/30.",
      result: "done",
    });

    const result = await runConversation({
      initHandler,
      turnHandler,
      budget: 3,
      responder,
    });

    expect(result).toBe("done");
    expect(responder.transcript).toEqual([
      { role: "agent", content: "ready?" },
      { role: "user", content: "ok" },
      { role: "agent", content: "Locked in 70/30." },
    ]);
  });

  it("should send Done.message from initHandler (early-resolve with acknowledgment)", async () => {
    const responder = createTrackedResponder([]);

    const initHandler: InitHandler<string> = async () => ({
      kind: DirectiveKind.Done,
      message: "Nothing to do here.",
      result: "skipped",
    });
    const turnHandler = vi.fn<TurnHandler<string>>();

    const result = await runConversation({
      initHandler,
      turnHandler,
      budget: 3,
      responder,
    });

    expect(result).toBe("skipped");
    expect(turnHandler).not.toHaveBeenCalled();
    expect(responder.transcript).toEqual([
      { role: "agent", content: "Nothing to do here." },
    ]);
  });

  it("should deep-clone history before passing to turnHandler so handler mutations don't leak", async () => {
    const responder = createTrackedResponder(["r1", "r2"]);
    // Snapshot before mutating, otherwise the recorded array IS the mutated one.
    const snapshotsOnEntry: EasyInputMessage[][] = [];

    const initHandler: InitHandler<string> = async () => ({
      kind: DirectiveKind.Ask,
      message: "q1",
    });
    const turnHandler: TurnHandler<string> = async (history) => {
      snapshotsOnEntry.push([...history]);
      (history as EasyInputMessage[]).push({
        role: "assistant",
        content: "INJECTED",
      });

      return snapshotsOnEntry.length === 1
        ? { kind: DirectiveKind.Ask, message: "q2" }
        : { kind: DirectiveKind.Done, result: "ok" };
    };

    await runConversation({ initHandler, turnHandler, budget: 5, responder });

    expect(snapshotsOnEntry[1]).not.toContainEqual({
      role: "assistant",
      content: "INJECTED",
    });
    expect(snapshotsOnEntry[1]).toEqual([
      { role: "assistant", content: "q1" },
      { role: "user", content: "r1" },
      { role: "assistant", content: "q2" },
      { role: "user", content: "r2" },
    ]);
  });
});
