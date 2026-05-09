import { zodTextFormat } from "openai/helpers/zod";
import type { EasyInputMessage } from "openai/resources/responses/responses";
import type { ReasoningEffort, ResponsesModel } from "openai/resources/shared";
import { z } from "zod";

import { InternalError } from "#errors";
import { createLogger } from "#lib/logger";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("clarifyAsk");

export class ConvergenceFailedError extends InternalError {
  constructor(question: string, followUps: number) {
    super(
      `askWithClassify failed to converge after ${followUps + 1} attempts for: "${question}"`,
    );
    this.name = "ConvergenceFailedError";
  }
}

export class MissingClarificationMessageError extends InternalError {
  constructor() {
    super("askWithClassify: clarificationNeeded=true but clarificationMessage is null");
    this.name = "MissingClarificationMessageError";
  }
}

export const AskWithClassifyBaseSchema = z.object({
  clarificationNeeded: z.boolean(),
  // Must be non-null when clarificationNeeded is true — enforced by instructions only.
  // A discriminated union would express this structurally, but zodTextFormat doesn't support oneOf yet.
  clarificationMessage: z.string().nullable(),
});

type AskWithClassifyBase = z.infer<typeof AskWithClassifyBaseSchema>;

type AskWithClassifyParams<TOutput extends AskWithClassifyBase> = {
  question: string;
  classifyInstructions: string;
  schema: z.ZodType<TOutput>;
  sendToUser: SendToUser;
  waitForResponse: WaitForResponse;
  model: ResponsesModel;
  effort: ReasoningEffort;
  // Number of follow-up clarification exchanges allowed before giving up.
  // Total classification attempts = followUps + 1 (the final attempt below the loop).
  followUps: number;
};

export const askWithClassify = async <TOutput extends AskWithClassifyBase>(
  params: AskWithClassifyParams<TOutput>,
): Promise<TOutput> => {
  const {
    question,
    classifyInstructions,
    schema,
    sendToUser,
    waitForResponse,
    model,
    effort,
    followUps,
  } = params;

  logger.info("askWithClassify asking", { question });

  sendToUser(question);

  const history: EasyInputMessage[] = [{ role: "assistant", content: question }];

  const format = zodTextFormat(schema, "output");

  // Each iteration classifies the user's response and, if clarification is needed,
  // sends a follow-up and loops. The final attempt is handled separately below
  // because there is no next turn — we classify but never send after it.
  for (let attempt = 0; attempt < followUps; attempt++) {
    const userResponse = await waitForResponse();
    history.push({ role: "user", content: userResponse });

    logger.debug("User response", { userResponse });

    const { id, output, usage } = await callOpenAIParsed<TOutput>({
      model,
      instructions: classifyInstructions,
      input: history,
      text: { format },
      reasoning: { effort },
    });

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

      return output;
    }

    if (!clarificationMessage) {
      throw new MissingClarificationMessageError();
    }

    history.push({ role: "assistant", content: clarificationMessage });

    logger.debug("askWithClassify sending clarification", { clarificationMessage });

    sendToUser(clarificationMessage);
  }

  // Final attempt — classify the last response but do not send a follow-up.
  const finalResponse = await waitForResponse();
  history.push({ role: "user", content: finalResponse });

  logger.debug("User response", { userResponse: finalResponse });

  const { id, output, usage } = await callOpenAIParsed<TOutput>({
    model,
    instructions: classifyInstructions,
    input: history,
    text: { format },
    reasoning: { effort },
  });

  logger.info("askWithClassify classification", {
    clarificationNeeded: output.clarificationNeeded,
    attempt: followUps,
    responseId: id,
    question,
    usage,
  });

  if (!output.clarificationNeeded) {
    logger.info("askWithClassify complete", { attempt: followUps, question });

    return output;
  }

  logger.warn("askWithClassify follow-ups exhausted", { question });

  throw new ConvergenceFailedError(question, followUps);
};
