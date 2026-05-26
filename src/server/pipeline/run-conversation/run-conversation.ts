import type { EasyInputMessage } from "openai/resources/responses/responses";

import { createLogger } from "#lib/logger";
import {
  DirectiveKind,
  type RunConversationParams,
} from "#pipeline/run-conversation/run-conversation.types";

const logger = createLogger("runConversation");

export const runConversation = async <TResult>({
  initHandler,
  turnHandler,
  responder,
}: RunConversationParams<TResult>): Promise<TResult> => {
  logger.info("Starting conversation");

  const history: EasyInputMessage[] = [];

  let directive = await initHandler();
  while (true) {
    switch (directive.kind) {
      case DirectiveKind.Done: {
        if (directive.message) {
          history.push({ role: "assistant", content: directive.message });
          responder.sendToUser(directive.message);
          logger.info("Sent closing message", { message: directive.message });
        }

        logger.info("Conversation complete");

        return directive.result;
      }
      case DirectiveKind.Ask: {
        history.push({ role: "assistant", content: directive.message });
        responder.sendToUser(directive.message);
        logger.info("Asked user", { message: directive.message });

        const userResponse = await responder.waitForResponse();
        history.push({ role: "user", content: userResponse });
        logger.info("Turn complete", { userResponse });

        directive = await turnHandler(structuredClone(history), userResponse);
        logger.info("Turn handler returned", { kind: directive.kind });

        break;
      }
      default: {
        const _exhaustive: never = directive;

        throw new Error(
          `runConversation: unhandled directive ${JSON.stringify(_exhaustive)}`,
        );
      }
    }
  }
};
