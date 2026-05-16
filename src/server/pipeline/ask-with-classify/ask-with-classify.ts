import { zodTextFormat } from "openai/helpers/zod";
import type { EasyInputMessage } from "openai/resources/responses/responses";
import type { z } from "zod";

import { InternalError } from "#errors";
import { createLogger } from "#lib/logger";
import {
  ClassifyFollowUpsExhaustedError,
  ClassifyMessageMissingError,
  ClassifyResolvedOutputInvalidError,
} from "#pipeline/ask-with-classify/ask-with-classify.errors";
import type {
  AskWithClassifyBase,
  AskWithClassifyParams,
} from "#pipeline/ask-with-classify/ask-with-classify.types";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("askWithClassify");

const resolveOutput = <TResolved>(
  output: unknown,
  resolvedSchema: z.ZodType<TResolved>,
): TResolved => {
  const parsed = resolvedSchema.safeParse(output);
  if (!parsed.success) throw new ClassifyResolvedOutputInvalidError(parsed.error);

  return parsed.data;
};

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

  logger.info("Asking question", { question });
  responder.sendToUser(question);

  const history: EasyInputMessage[] = [{ role: "assistant", content: question }];
  const format = zodTextFormat(schema, "output");

  const totalAttempts = followUps + 1;
  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    logger.info("Attempt", { attempt, totalAttempts });

    const userResponse = await responder.waitForResponse();
    history.push({ role: "user", content: userResponse });
    logger.debug("User response", { userResponse });

    const { id, output } = await callOpenAIParsed(
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

    logger.info("Classification", {
      responseId: id,
      clarificationNeeded,
    });

    if (!clarificationNeeded) {
      logger.info("Complete");

      return resolveOutput(output, resolvedSchema);
    }
    // Final attempt — exhaust before processing a clarification we wouldn't send.
    // Consequence: a final attempt with clarificationNeeded=true AND clarificationMessage=null
    // yields ClassifyFollowUpsExhaustedError, not ClassifyMessageMissingError — the
    // user-driven outcome takes precedence over the model-bug outcome.
    // Throw silently: the consumer logs (mapClassifyError or the phase's own
    // catch-site warn for collapsing phases) own the log line for this error.
    if (attempt === followUps)
      throw new ClassifyFollowUpsExhaustedError(question, followUps);
    if (!clarificationMessage) throw new ClassifyMessageMissingError();

    history.push({ role: "assistant", content: clarificationMessage });
    logger.debug("Clarification", { clarificationMessage });
    responder.sendToUser(clarificationMessage);
  }

  // Loop always returns or throws — TS requires this for inference.
  throw new InternalError(
    `Exited loop unexpectedly for "${question}" with followUps=${followUps}`,
  );
};
