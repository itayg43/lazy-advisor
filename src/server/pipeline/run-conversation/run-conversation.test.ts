import type { EasyInputMessage } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackedResponder } from "#pipeline/eval.transcript";
import {
  DirectiveKind,
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

    const initHandler: InitHandler<void, string> = async () => ({
      kind: DirectiveKind.Done,
      result: "early-done",
    });
    const turnHandler = vi.fn<TurnHandler<void, string>>();

    const result = await runConversation({
      initHandler,
      turnHandler,
      responder,
    });

    expect(result).toBe("early-done");
    expect(turnHandler).not.toHaveBeenCalled();
    expect(responder.transcript).toEqual([]);
  });

  it("should complete a single-turn conversation and return the handler's result", async () => {
    const responder = createTrackedResponder(["yes"]);

    const initHandler: InitHandler<void, { ok: boolean }> = async () => ({
      kind: DirectiveKind.Ask,
      state: undefined,
      message: "ready?",
    });
    const turnHandler: TurnHandler<void, { ok: boolean }> = async (
      _state,
      _history,
      lastUserResponse,
    ) => ({
      kind: DirectiveKind.Done,
      result: { ok: lastUserResponse === "yes" },
    });

    const result = await runConversation({
      initHandler,
      turnHandler,
      responder,
    });

    expect(result).toEqual({ ok: true });
    expect(responder.transcript).toEqual([
      { role: "agent", content: "ready?" },
      { role: "user", content: "yes" },
    ]);
  });

  it("should pass history and lastUserResponse to turnHandler in order", async () => {
    const responder = createTrackedResponder(["reply-1", "reply-2"]);
    const calls: Array<{
      history: ReadonlyArray<EasyInputMessage>;
      lastUserResponse: string;
    }> = [];

    const initHandler: InitHandler<void, string> = async () => ({
      kind: DirectiveKind.Ask,
      state: undefined,
      message: "q1",
    });
    let callIndex = 0;
    const turnHandler: TurnHandler<void, string> = async (
      _state,
      history,
      lastUserResponse,
    ) => {
      callIndex++;
      calls.push({ history: [...history], lastUserResponse });

      return callIndex === 1
        ? { kind: DirectiveKind.Ask, state: undefined, message: "q2" }
        : { kind: DirectiveKind.Done, result: "ok" };
    };

    await runConversation({ initHandler, turnHandler, responder });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      history: [
        { role: "assistant", content: "q1" },
        { role: "user", content: "reply-1" },
      ],
      lastUserResponse: "reply-1",
    });
    expect(calls[1]).toEqual({
      history: [
        { role: "assistant", content: "q1" },
        { role: "user", content: "reply-1" },
        { role: "assistant", content: "q2" },
        { role: "user", content: "reply-2" },
      ],
      lastUserResponse: "reply-2",
    });
  });

  it("should send Done.message to the user before returning", async () => {
    const responder = createTrackedResponder(["ok"]);

    const initHandler: InitHandler<void, string> = async () => ({
      kind: DirectiveKind.Ask,
      state: undefined,
      message: "ready?",
    });
    const turnHandler: TurnHandler<void, string> = async () => ({
      kind: DirectiveKind.Done,
      message: "Locked in 70/30.",
      result: "done",
    });

    const result = await runConversation({
      initHandler,
      turnHandler,
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

    const initHandler: InitHandler<void, string> = async () => ({
      kind: DirectiveKind.Done,
      message: "Nothing to do here.",
      result: "skipped",
    });
    const turnHandler = vi.fn<TurnHandler<void, string>>();

    const result = await runConversation({
      initHandler,
      turnHandler,
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

    const initHandler: InitHandler<void, string> = async () => ({
      kind: DirectiveKind.Ask,
      state: undefined,
      message: "q1",
    });
    const turnHandler: TurnHandler<void, string> = async (_state, history) => {
      snapshotsOnEntry.push([...history]);
      (history as EasyInputMessage[]).push({
        role: "assistant",
        content: "INJECTED",
      });

      return snapshotsOnEntry.length === 1
        ? { kind: DirectiveKind.Ask, state: undefined, message: "q2" }
        : { kind: DirectiveKind.Done, result: "ok" };
    };

    await runConversation({ initHandler, turnHandler, responder });

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

  it("should thread state across turn handler invocations", async () => {
    const responder = createTrackedResponder(["r1", "r2"]);
    type State = { counter: number };
    const statesSeen: State[] = [];

    const initHandler: InitHandler<State, string> = async () => ({
      kind: DirectiveKind.Ask,
      state: { counter: 0 },
      message: "q1",
    });
    const turnHandler: TurnHandler<State, string> = async (state) => {
      statesSeen.push({ ...state });

      return statesSeen.length === 1
        ? {
            kind: DirectiveKind.Ask,
            state: { counter: state.counter + 1 },
            message: "q2",
          }
        : { kind: DirectiveKind.Done, result: `final-counter:${state.counter}` };
    };

    const result = await runConversation({
      initHandler,
      turnHandler,
      responder,
    });

    expect(statesSeen).toEqual([{ counter: 0 }, { counter: 1 }]);
    expect(result).toBe("final-counter:1");
  });
});
