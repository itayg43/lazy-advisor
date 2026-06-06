import type { EasyInputMessage } from "openai/resources/responses/responses";

import { createLogger } from "#lib/logger";
import {
  RunConversationHardStopError,
  RunConversationUnhandledOutputKindError,
} from "#pipeline/run-conversation/run-conversation.errors";
import {
  HandlerOutputKind,
  type HandlerOutput,
  type RunConversationParams,
} from "#pipeline/run-conversation/run-conversation.types";

const logger = createLogger("runConversation");

export const runConversation = async <TState, TResult>({
  initHandler,
  turnHandler,
  responder,
  hardStopTurns,
}: RunConversationParams<TState, TResult>): Promise<TResult> => {
  logger.debug("Starting conversation");

  let currentOutput: HandlerOutput<TState, TResult> = await initHandler();
  const history: EasyInputMessage[] = [];

  // `hardStopTurns` is a backstop, not the real limit: turn accounting lives in
  // the caller's phase state (e.g. `turnsTaken`), and a well-formed handler
  // returns Done before this trips. It exists so a buggy handler that always
  // returns Ask can't loop forever. The companion hang-exposure control — a wait
  // timeout — belongs inside `Responder.waitForResponse`, not here, since the
  // runner has no view into the underlying transport.
  //
  // We count asks emitted: when the cap is hit, the handler's preceding call
  // (e.g. the LLM turn that produced this Ask) is already spent and discarded.
  // That waste is acceptable — under correct self-limiting we never reach it.
  let asksEmitted = 0;
  while (true) {
    switch (currentOutput.kind) {
      case HandlerOutputKind.Done: {
        const { message, result } = currentOutput;

        if (message) {
          responder.sendToUser(message);
          logger.debug("Sent closing message", { message });
        }

        logger.debug("Conversation complete");

        return result;
      }
      case HandlerOutputKind.Ask: {
        if (asksEmitted >= hardStopTurns)
          throw new RunConversationHardStopError(hardStopTurns);

        asksEmitted++;

        const { message } = currentOutput;

        history.push({ role: "assistant", content: message });
        responder.sendToUser(message);
        logger.debug("Asked user", { message });

        const lastUserResponse = await responder.waitForResponse();
        history.push({ role: "user", content: lastUserResponse });
        logger.debug("User responded", { lastUserResponse });

        // State and the next directive are replaced together here: if the
        // following iteration's `sendToUser` throws, the closure unwinds and both
        // are discarded — no halfway-committed phase state. Fine for now: with no
        // session persistence, an unrecoverable error ends the conversation at the
        // stage boundary and the user restarts from scratch, so there's nothing to
        // resume to. Revisit when session state is persisted.
        currentOutput = await turnHandler(currentOutput.state, history, lastUserResponse);
        logger.debug("Turn handler returned", { ...currentOutput });

        break;
      }

      default: {
        const _exhaustive: never = currentOutput;

        throw new RunConversationUnhandledOutputKindError(JSON.stringify(_exhaustive));
      }
    }
  }
};
