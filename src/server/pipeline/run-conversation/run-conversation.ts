import type { EasyInputMessage } from "openai/resources/responses/responses";

import { createLogger } from "#lib/logger";
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
}: RunConversationParams<TState, TResult>): Promise<TResult> => {
  logger.debug("Starting conversation");

  let currentOutput: HandlerOutput<TState, TResult> = await initHandler();
  const history: EasyInputMessage[] = [];

  // No max-turn guard: a handler that always returns Ask will loop until the
  // responder rejects or the process is killed. Turn accounting lives in the
  // caller's phase state (e.g. `turnsTaken`), so the runner stays generic.
  // Revisit (`maxTurns` param here) before any production deployment where
  // cost exposure matters. The companion hang-exposure control — a wait
  // timeout — belongs inside `Responder.waitForResponse`, not in the runner,
  // since the runner has no view into the underlying transport.
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
        const { message } = currentOutput;

        history.push({ role: "assistant", content: message });
        responder.sendToUser(message);
        logger.debug("Asked user", { message });

        const lastUserResponse = await responder.waitForResponse();
        history.push({ role: "user", content: lastUserResponse });
        logger.debug("User responded", { lastUserResponse });

        // `currentOutput` is overwritten atomically here. If the next iteration's
        // `sendToUser` throws, the runner unwinds and the closure dies — the
        // freshly-returned state and directive are discarded together, so
        // there is no halfway-committed phase state to recover from.
        currentOutput = await turnHandler(currentOutput.state, history, lastUserResponse);
        logger.debug("Turn handler returned", { ...currentOutput });

        break;
      }

      default: {
        const _exhaustive: never = currentOutput;

        throw new Error(
          `runConversation: unhandled output kind: ${JSON.stringify(_exhaustive)}`,
        );
      }
    }
  }
};
