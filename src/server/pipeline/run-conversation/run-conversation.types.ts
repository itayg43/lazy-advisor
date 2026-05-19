import type { EasyInputMessage } from "openai/resources/responses/responses";

import type { Responder } from "#pipeline/tools/ask-user.tool";

export const DirectiveKind = {
  Ask: "ask",
  Done: "done",
} as const;

export type DirectiveKind = (typeof DirectiveKind)[keyof typeof DirectiveKind];

// What a handler tells the primitive to do next.
// - Ask: send `message`, await user reply, then call `turnHandler` again.
// - Done: stop the loop and return `result` from runConversation.
export type Directive<TResult> =
  | { kind: typeof DirectiveKind.Ask; message: string }
  | { kind: typeof DirectiveKind.Done; result: TResult };

// Called once before any user input. Produces the conversation's first directive.
// Split from TurnHandler so the turn signature doesn't have to model "no reply yet".
export type InitHandler<TResult> = () => Promise<Directive<TResult>>;

// Called after each user reply. `history` is read-only on purpose: handler-owned
// state (counters, flags, etc.) belongs in the handler's closure, not in history.
export type TurnHandler<TResult> = (
  history: ReadonlyArray<EasyInputMessage>,
  userReply: string,
  turnsUsed: number,
) => Promise<Directive<TResult>>;

export type RunConversationParams<TResult> = {
  initHandler: InitHandler<TResult>;
  turnHandler: TurnHandler<TResult>;
  budget: number;
  responder: Responder;
};
