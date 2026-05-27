import type { EasyInputMessage } from "openai/resources/responses/responses";

import type { Responder } from "#pipeline/tools/ask-user.tool";

export const DirectiveKind = {
  Ask: "ask",
  Done: "done",
} as const;

export type DirectiveKind = (typeof DirectiveKind)[keyof typeof DirectiveKind];

// What a handler tells the primitive to do next.
// - Ask: send `message`, await user reply, then call `turnHandler` again.
// - Done: optionally send `message`, then stop the loop and return `result`.
export type Directive<TResult> =
  | { kind: typeof DirectiveKind.Ask; message: string }
  | {
      kind: typeof DirectiveKind.Done;
      /**
       * Optional closing message. When set, the primitive sends it to the user
       * (and pushes it onto history) before returning `result`. Omit when the
       * phase resolves without user-visible output — e.g., early skip from
       * `initHandler` (T6's `bufferPercentage === 0` case).
       */
      message?: string;
      result: TResult;
    };

// Called once before any user input. Produces the conversation's first directive.
// Split from TurnHandler so the turn signature doesn't have to model "no reply yet".
export type InitHandler<TResult> = () => Promise<Directive<TResult>>;

// Called after each user reply. `history` is read-only on purpose: handler-owned
// state (counters, flags, etc.) belongs in the handler's closure, not in history.
// The primitive deep-clones `history` before each call, so mutations don't leak
// back — the `ReadonlyArray` type is enforced at runtime too.
export type TurnHandler<TResult> = (
  history: ReadonlyArray<EasyInputMessage>,
  lastUserResponse: string,
) => Promise<Directive<TResult>>;

export type RunConversationParams<TResult> = {
  initHandler: InitHandler<TResult>;
  turnHandler: TurnHandler<TResult>;
  responder: Responder;
};
