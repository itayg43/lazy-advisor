import type { EasyInputMessage } from "openai/resources/responses/responses";

import { createLogger } from "#lib/logger";
import { ConversationBudgetExhaustedError } from "#pipeline/run-conversation/run-conversation.errors";
import {
  DirectiveKind,
  type RunConversationParams,
} from "#pipeline/run-conversation/run-conversation.types";

const logger = createLogger("runConversation");

export const runConversation = async <TResult>({
  initHandler,
  turnHandler,
  budget,
  responder,
}: RunConversationParams<TResult>): Promise<TResult> => {
  logger.info("Starting conversation", { budget });

  const history: EasyInputMessage[] = [];

  let turnsUsed = 0;
  let directive = await initHandler();
  while (true) {
    if (directive.kind === DirectiveKind.Done) {
      logger.info("Conversation complete");

      return directive.result;
    }
    if (directive.kind === DirectiveKind.Ask) {
      history.push({ role: "assistant", content: directive.message });
      responder.sendToUser(directive.message);
      logger.info("Asked user", { message: directive.message });

      const userResponse = await responder.waitForResponse();
      history.push({ role: "user", content: userResponse });
      logger.info("Turn complete", { userResponse });

      turnsUsed++;
      if (turnsUsed > budget) {
        logger.warn("Budget exhausted", { budget });

        throw new ConversationBudgetExhaustedError(budget);
      }

      directive = await turnHandler(history, userResponse, turnsUsed);
      logger.info("Turn handler returned", { kind: directive.kind });
    }
  }
};
