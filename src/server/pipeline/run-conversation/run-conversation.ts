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
  logger.info("Starting conversation");

  let currentOutput: HandlerOutput<TState, TResult> = await initHandler();
  const history: EasyInputMessage[] = [];

  while (true) {
    const { kind } = currentOutput;

    switch (kind) {
      case HandlerOutputKind.Done: {
        const { message, result } = currentOutput;

        if (message) {
          history.push({ role: "assistant", content: message });
          responder.sendToUser(message);
          logger.info("Sent closing message", { message });
        }

        logger.info("Conversation complete");

        return result;
      }
      case HandlerOutputKind.Ask: {
        history.push({ role: "assistant", content: currentOutput.message });
        responder.sendToUser(currentOutput.message);
        logger.info("Asked user", { message: currentOutput.message });

        const lastUserResponse = await responder.waitForResponse();
        history.push({ role: "user", content: lastUserResponse });
        logger.info("Turn complete", { lastUserResponse });

        // `currentOutput` is overwritten atomically here. If the next iteration's
        // `sendToUser` throws, the runner unwinds and the closure dies — the
        // freshly-returned state and directive are discarded together, so
        // there is no halfway-committed phase state to recover from.
        currentOutput = await turnHandler(
          currentOutput.state,
          structuredClone(history),
          lastUserResponse,
        );
        // Read `kind` off the freshly-assigned `currentOutput`, not the
        // destructured `kind` above — that one still holds the pre-turn value.
        logger.info("Turn handler returned", { kind: currentOutput.kind });

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
