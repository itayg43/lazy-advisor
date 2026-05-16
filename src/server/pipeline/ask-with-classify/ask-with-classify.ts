import { zodTextFormat } from "openai/helpers/zod";
import type { EasyInputMessage } from "openai/resources/responses/responses";

import { InternalError } from "#errors";
import { createLogger } from "#lib/logger";
import {
  ClassifyFollowUpsExhaustedError,
  ClassifyMessageMissingError,
  ClassifyOutputInvalidError,
} from "#pipeline/ask-with-classify/ask-with-classify.errors";
import type {
  AskWithClassifyBase,
  AskWithClassifyParams,
} from "#pipeline/ask-with-classify/ask-with-classify.types";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("askWithClassify");

export const askWithClassify = async <
  TOutput extends AskWithClassifyBase,
  TResolved extends TOutput,
>(
  params: AskWithClassifyParams<TOutput, TResolved>,
): Promise<TResolved> => {
  const {
    question,
    classifyInstructions,
    schema,
    resolvedSchema,
    responder,
    model,
    effort,
    followUps,
  } = params;

  logger.info("askWithClassify asking", { question });

  responder.sendToUser(question);

  const history: EasyInputMessage[] = [{ role: "assistant", content: question }];

  const format = zodTextFormat(schema, "output");

  const totalAttempts = followUps + 1;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    const userResponse = await responder.waitForResponse();
    history.push({ role: "user", content: userResponse });

    logger.debug("User response", { userResponse });

    const { id, output, usage } = await callOpenAIParsed(
      {
        model,
        instructions: classifyInstructions,
        input: history,
        text: { format },
        reasoning: { effort },
      },
      schema,
    );

    const { clarificationNeeded, clarificationMessage } = output;

    logger.info("askWithClassify classification", {
      clarificationNeeded,
      attempt,
      responseId: id,
      question,
      usage,
    });

    if (!clarificationNeeded) {
      logger.info("askWithClassify complete", { attempt, question });

      const parsed = resolvedSchema.safeParse(output);
      if (!parsed.success) throw new ClassifyOutputInvalidError(parsed.error);

      return parsed.data;
    }

    // No follow-ups left — surface exhaustion instead of validating/sending a message we'd never use.
    if (attempt === totalAttempts - 1) {
      logger.warn("askWithClassify follow-ups exhausted", { question });

      throw new ClassifyFollowUpsExhaustedError(question, followUps);
    }

    if (!clarificationMessage) {
      throw new ClassifyMessageMissingError();
    }

    history.push({ role: "assistant", content: clarificationMessage });

    logger.debug("askWithClassify sending clarification", { clarificationMessage });

    responder.sendToUser(clarificationMessage);
  }

  // Loop always returns or throws — TS requires this for inference.
  throw new InternalError("askWithClassify exited loop unexpectedly");
};
