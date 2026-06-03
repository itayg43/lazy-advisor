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
 * Called after each user reply. State is threaded through return values —
 * `Readonly<TState>` and `ReadonlyArray` enforce at compile time that handlers
 * don't mutate their inputs. No runtime copy: handlers are internal code and
 * the type system is the contract.
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
};
