import type { EasyInputMessage } from "openai/resources/responses/responses";

import type { Responder } from "#pipeline/tools/ask-user.tool";

export const DirectiveKind = {
  Ask: "ask",
  Done: "done",
} as const;

export type DirectiveKind = (typeof DirectiveKind)[keyof typeof DirectiveKind];

// What a handler produces. Discriminated on `DirectiveKind` so `state` is
// only required on the Ask path — a handler returning Done is ending the
// phase and has no successor state to hand back. The Done arm's `message`
// is optional: when set, the runner sends it (and pushes it onto history)
// before returning `result`; omit when the phase resolves without
// user-visible output — e.g., early skip from `initHandler` (T6's
// `bufferPercentage === 0` case).
export type TurnHandlerOutput<TState, TResult> =
  | { kind: typeof DirectiveKind.Ask; state: TState; message: string }
  | {
      kind: typeof DirectiveKind.Done;
      message?: string;
      result: TResult;
    };

// `initHandler` produces the same shape as a turn — aliased rather than
// duplicated so the runner can treat the first output and every subsequent
// output uniformly. The two aliases document *where* the value comes from.
export type InitHandlerOutput<TState, TResult> = TurnHandlerOutput<TState, TResult>;

// Called once before any user input. Produces the first output and, when
// the conversation continues, the initial phase state. Split from
// `TurnHandler` so the turn signature doesn't have to model "no reply yet".
export type InitHandler<TState, TResult> = () => Promise<
  InitHandlerOutput<TState, TResult>
>;

// Called after each user reply. State is threaded through return values —
// `Readonly<TState>` and `ReadonlyArray` enforce at compile time that handlers
// don't mutate their inputs. The runner deep-clones `history` before each call
// as a runtime backstop.
export type TurnHandler<TState, TResult> = (
  state: Readonly<TState>,
  history: ReadonlyArray<EasyInputMessage>,
  lastUserResponse: string,
) => Promise<TurnHandlerOutput<TState, TResult>>;

export type RunConversationParams<TState, TResult> = {
  initHandler: InitHandler<TState, TResult>;
  turnHandler: TurnHandler<TState, TResult>;
  responder: Responder;
};
