import { InternalError } from "#errors";

// Both errors guard runner invariants that hold under correct usage, so a throw
// means a bug, not an expected outcome — hence InternalError (500), bubbling to
// the central `runClarifyOrchestrator` catch which logs it once and maps the stage to errored.

export class RunConversationHardStopError extends InternalError {
  constructor(hardStopTurns: number) {
    super(
      `runConversation: hard-stop reached after ${hardStopTurns} asks — a handler failed to self-limit`,
    );
    this.name = "RunConversationHardStopError";
  }
}

export class RunConversationUnhandledOutputKindError extends InternalError {
  constructor(kind: string) {
    super(`runConversation: unhandled output kind: ${kind}`);
    this.name = "RunConversationUnhandledOutputKindError";
  }
}
