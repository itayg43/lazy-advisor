import type { EasyInputMessage } from "openai/resources/responses/responses";

import type { Responder } from "#pipeline/tools/ask-user.tool";

/**
 * Recursively marks every property readonly, unlike the built-in `Readonly`
 * which is shallow. Used to model an owned borrow: a handler receives state it
 * may read but not mutate at any depth, and must return a new object instead.
 */
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

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
 * changing the state it was given. Both arguments are borrows, but the runner
 * enforces them differently because it holds them differently:
 *
 * `state` is owned-and-returned: the runner hands it off, expects a new state
 * back, and never reads the old object again. There's no retained alias to
 * corrupt, so a compile-time `DeepReadonly` reminder is enough — it's erased at
 * runtime, but the runner doesn't need a runtime guarantee here.
 *
 * `history` is retained-and-shared: the runner keeps one canonical array and
 * appends to it every turn. A type can't protect that — `ReadonlyArray` is
 * compile-time and castable — so the runner passes a `structuredClone` each
 * turn. That runtime copy, not the type, is what stops a handler that mutates
 * its `history` argument (e.g. a future equity/buffer RAG loop) from corrupting
 * the conversation.
 */
export type TurnHandler<TState, TResult> = (
  state: DeepReadonly<TState>,
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
