import type { EasyInputMessage } from "openai/resources/responses/responses";

import { InternalError } from "#errors";
import { createLogger } from "#lib/logger";
import {
  HandlerOutputKind,
  type HandlerOutput,
  type RunConversationParams,
} from "#pipeline/run-conversation/run-conversation.types";

const logger = createLogger("runConversation");

export const runConversation = async <TState, TResult>(
  params: RunConversationParams<TState, TResult>,
): Promise<TResult> => {
  const { initHandler, turnHandler, responder, hardStopTurns } = params;

  logger.debug("Starting conversation");

  let currentOutput: HandlerOutput<TState, TResult> = await initHandler();
  const history: EasyInputMessage[] = [];

  // Backstop only: real turn accounting lives in the caller's phase state, and a
  // well-formed handler returns Done first. Guards against a handler that always
  // returns Prompt. See ALLOCATION_AUDIT.md (Finding 2) for the coupling with the
  // phase budget and why the wait-timeout lives in the Responder, not here.
  let promptsEmitted = 0;
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
      case HandlerOutputKind.Prompt: {
        // Guards a runner invariant: under correct self-limiting we never reach
        // this, so a throw means a buggy handler, not an expected outcome — hence
        // InternalError (500), which bubbles to the central `runClarifyOrchestrator`
        // catch that logs it once and maps the stage to errored.
        if (promptsEmitted >= hardStopTurns)
          throw new InternalError(
            `runConversation: hard-stop reached after ${hardStopTurns} prompts — a handler failed to self-limit`,
          );

        promptsEmitted++;

        const { message } = currentOutput;

        history.push({ role: "assistant", content: message });
        responder.sendToUser(message);
        logger.debug("Prompted user", { message });

        const lastUserResponse = await responder.waitForResponse();
        history.push({ role: "user", content: lastUserResponse });
        logger.debug("User responded", { lastUserResponse });

        // structuredClone isolates the runner's canonical `history` from the
        // handler, so a handler that mutates its argument (e.g. a future
        // equity/buffer RAG loop) can't corrupt the conversation. State + next
        // directive are replaced together, so a throw on the next iteration
        // discards both — no halfway-committed state. (No session persistence yet;
        // revisit when there is.)
        currentOutput = await turnHandler(
          currentOutput.state,
          structuredClone(history),
          lastUserResponse,
        );
        logger.debug("Turn handler returned", { ...currentOutput });

        break;
      }

      default: {
        const _exhaustive: never = currentOutput;

        throw new InternalError(
          `runConversation: unhandled output kind: ${JSON.stringify(_exhaustive)}`,
        );
      }
    }
  }
};
