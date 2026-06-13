import type { EasyInputMessage } from "openai/resources/responses/responses";

import type { Responder } from "#pipeline/tools/ask-user.tool";

export const HandlerOutputKind = {
  Ask: "ask",
  Done: "done",
} as const;

export type HandlerOutputKind =
  (typeof HandlerOutputKind)[keyof typeof HandlerOutputKind];

/**
 * Discriminated on `HandlerOutputKind` so `state` is only required on the Ask
 * path — a handler returning Done is ending the phase and has no successor
 * state to hand back. The Done arm's `message` is optional: when set, the
 * runner sends it (and pushes it onto history) before returning `result`;
 * omit when the phase resolves without user-visible output — e.g., early
 * skip from `initHandler` (T6's `bufferPercentage === 0` case).
 */
export type HandlerOutput<TState, TResult> =
  | { kind: typeof HandlerOutputKind.Ask; state: TState; message: string }
  | {
      kind: typeof HandlerOutputKind.Done;
      message?: string;
      result: TResult;
    };

/**
 * Called once before any user input. Produces the first output and, when
 * the conversation continues, the initial phase state. Split from
 * `TurnHandler` so the turn signature doesn't have to model "no reply yet".
 */
export type InitHandler<TState, TResult> = () => Promise<HandlerOutput<TState, TResult>>;

/**
 * Called after each user reply. A handler returns its next state instead of
 * changing the state it was given. The `Readonly`/`ReadonlyArray` types are a
 * reminder to follow that rule, not a real guarantee: `Readonly` is shallow,
 * gone at runtime, and TypeScript still lets you pass a readonly object where a
 * mutable one is expected. It works here because `TState` is flat primitives and
 * handlers build a new object via spread; nested or shared state would slip past
 * it and need a deeper readonly type.
 */
export type TurnHandler<TState, TResult> = (
  state: Readonly<TState>,
  history: ReadonlyArray<EasyInputMessage>,
  lastUserResponse: string,
) => Promise<HandlerOutput<TState, TResult>>;

export type RunConversationParams<TState, TResult> = {
  initHandler: InitHandler<TState, TResult>;
  turnHandler: TurnHandler<TState, TResult>;
  responder: Responder;
  /**
   * Backstop on the number of asks the runner will emit before it throws —
   * defense-in-depth against a handler that never returns Done. Distinct from
   * a phase's own turn budget (e.g. `ALLOCATION_MAX_NEGOTIATION_TURNS`): set it a margin
   * above the real budget — enough slack to absorb an off-by-one in the
   * handler's accounting, tight enough to catch a runaway handler quickly — so
   * it only trips on a bug. Required so every caller states its ceiling rather
   * than inheriting a hidden default.
   */
  hardStopTurns: number;
};
