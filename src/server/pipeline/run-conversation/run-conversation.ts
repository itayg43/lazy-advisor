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

  let next: HandlerOutput<TState, TResult> = await initHandler();
  const history: EasyInputMessage[] = [];

  while (true) {
    switch (next.kind) {
      case HandlerOutputKind.Done: {
        if (next.message) {
          history.push({ role: "assistant", content: next.message });
          responder.sendToUser(next.message);
          logger.info("Sent closing message", { message: next.message });
        }

        logger.info("Conversation complete");

        return next.result;
      }
      case HandlerOutputKind.Ask: {
        history.push({ role: "assistant", content: next.message });
        responder.sendToUser(next.message);
        logger.info("Asked user", { message: next.message });

        const lastUserResponse = await responder.waitForResponse();
        history.push({ role: "user", content: lastUserResponse });
        logger.info("Turn complete", { lastUserResponse });

        // `next` is overwritten atomically here. If the next iteration's
        // `sendToUser` throws, the runner unwinds and the closure dies — the
        // freshly-returned state and directive are discarded together, so
        // there is no halfway-committed phase state to recover from.
        next = await turnHandler(next.state, structuredClone(history), lastUserResponse);
        logger.info("Turn handler returned", { kind: next.kind });

        break;
      }
      default: {
        const _exhaustive: never = next;

        throw new Error(
          `runConversation: unhandled output ${JSON.stringify(_exhaustive)}`,
        );
      }
    }
  }
};
