import type { EasyInputMessage } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTrackedResponder } from "#pipeline/eval.transcript";
import {
  HandlerOutputKind,
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

    const initHandler = vi.fn<InitHandler<void, string>>().mockResolvedValue({
      kind: HandlerOutputKind.Done,
      result: "early-done",
    });
    const turnHandler = vi.fn<TurnHandler<void, string>>();

    const result = await runConversation({
      initHandler,
      turnHandler,
      responder,
      hardStopTurns: 10,
    });

    expect(result).toBe("early-done");
    expect(turnHandler).not.toHaveBeenCalled();
    expect(responder.transcript).toEqual([]);
  });

  it("should complete a single-turn conversation and return the handler's result", async () => {
    const responder = createTrackedResponder(["yes"]);

    const initHandler = vi.fn<InitHandler<void, { ok: boolean }>>().mockResolvedValue({
      kind: HandlerOutputKind.Ask,
      state: undefined,
      message: "ready?",
    });
    const turnHandler = vi.fn<TurnHandler<void, { ok: boolean }>>(
      async (_state, _history, lastUserResponse) => ({
        kind: HandlerOutputKind.Done,
        result: { ok: lastUserResponse === "yes" },
      }),
    );

    const result = await runConversation({
      initHandler,
      turnHandler,
      responder,
      hardStopTurns: 10,
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

    const initHandler = vi.fn<InitHandler<void, string>>().mockResolvedValue({
      kind: HandlerOutputKind.Ask,
      state: undefined,
      message: "q1",
    });
    let callIndex = 0;
    const turnHandler = vi.fn<TurnHandler<void, string>>(
      async (_state, history, lastUserResponse) => {
        callIndex++;
        calls.push({ history: [...history], lastUserResponse });

        return callIndex === 1
          ? { kind: HandlerOutputKind.Ask, state: undefined, message: "q2" }
          : { kind: HandlerOutputKind.Done, result: "ok" };
      },
    );

    await runConversation({ initHandler, turnHandler, responder, hardStopTurns: 10 });

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

    const initHandler = vi.fn<InitHandler<void, string>>().mockResolvedValue({
      kind: HandlerOutputKind.Ask,
      state: undefined,
      message: "ready?",
    });
    const turnHandler = vi.fn<TurnHandler<void, string>>().mockResolvedValue({
      kind: HandlerOutputKind.Done,
      message: "Locked in 70/30.",
      result: "done",
    });

    const result = await runConversation({
      initHandler,
      turnHandler,
      responder,
      hardStopTurns: 10,
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

    const initHandler = vi.fn<InitHandler<void, string>>().mockResolvedValue({
      kind: HandlerOutputKind.Done,
      message: "Nothing to do here.",
      result: "skipped",
    });
    const turnHandler = vi.fn<TurnHandler<void, string>>();

    const result = await runConversation({
      initHandler,
      turnHandler,
      responder,
      hardStopTurns: 10,
    });

    expect(result).toBe("skipped");
    expect(turnHandler).not.toHaveBeenCalled();
    expect(responder.transcript).toEqual([
      { role: "agent", content: "Nothing to do here." },
    ]);
  });

  it("should thread state across turn handler invocations", async () => {
    const responder = createTrackedResponder(["r1", "r2"]);
    type State = { counter: number };
    const statesSeen: State[] = [];

    const initHandler = vi.fn<InitHandler<State, string>>().mockResolvedValue({
      kind: HandlerOutputKind.Ask,
      state: { counter: 0 },
      message: "q1",
    });
    const turnHandler = vi.fn<TurnHandler<State, string>>(async (state) => {
      statesSeen.push({ ...state });

      return statesSeen.length === 1
        ? {
            kind: HandlerOutputKind.Ask,
            state: { counter: state.counter + 1 },
            message: "q2",
          }
        : { kind: HandlerOutputKind.Done, result: `final-counter:${state.counter}` };
    });

    const result = await runConversation({
      initHandler,
      turnHandler,
      responder,
      hardStopTurns: 10,
    });

    expect(statesSeen).toEqual([{ counter: 0 }, { counter: 1 }]);
    expect(result).toBe("final-counter:1");
  });

  it("should throw on an unknown HandlerOutputKind", async () => {
    const responder = createTrackedResponder([]);

    // Force an invalid kind past the type system to assert the runtime guard.
    const initHandler = (async () => ({
      kind: "bogus",
      result: "never",
    })) as unknown as InitHandler<void, string>;
    const turnHandler = vi.fn<TurnHandler<void, string>>();

    await expect(
      runConversation({ initHandler, turnHandler, responder, hardStopTurns: 10 }),
    ).rejects.toThrow(/unhandled output kind/);

    expect(turnHandler).not.toHaveBeenCalled();
  });

  it("should throw after emitting hardStopTurns asks", async () => {
    const responder = createTrackedResponder(["r1", "r2", "r3", "r4"]);

    // A handler that never returns Done — the runaway case the backstop exists for.
    const initHandler = vi.fn<InitHandler<void, string>>().mockResolvedValue({
      kind: HandlerOutputKind.Ask,
      state: undefined,
      message: "q",
    });
    const turnHandler = vi.fn<TurnHandler<void, string>>().mockResolvedValue({
      kind: HandlerOutputKind.Ask,
      state: undefined,
      message: "q",
    });

    await expect(
      runConversation({ initHandler, turnHandler, responder, hardStopTurns: 3 }),
    ).rejects.toThrow(/hard-stop reached/);

    // Tripped on the would-be 4th ask: exactly hardStopTurns asks reached the user.
    const agentMessages = responder.transcript.filter((m) => m.role === "agent");
    expect(agentMessages).toHaveLength(3);
  });
});
