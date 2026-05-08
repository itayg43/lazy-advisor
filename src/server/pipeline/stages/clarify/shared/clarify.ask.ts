import { zodTextFormat } from "openai/helpers/zod";
import type { EasyInputMessage } from "openai/resources/responses/responses";
import type { ReasoningEffort, ResponsesModel } from "openai/resources/shared";
import { z } from "zod";

import { createLogger } from "#lib/logger";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("clarifyAsk");

export class RetriesExhaustedError extends Error {
  constructor(question: string, retries: number) {
    super(
      `askWithClassify failed to converge after ${retries + 1} attempts for: "${question}"`,
    );
    this.name = "RetriesExhaustedError";
  }
}

export class MissingClarificationMessageError extends Error {
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
  retries: number;
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
    retries,
  } = params;

  logger.info("askWithClassify asking", { question });

  sendToUser(question);

  const history: EasyInputMessage[] = [{ role: "assistant", content: question }];
  const format = zodTextFormat(schema, "output");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const userResponse = await waitForResponse();
    history.push({ role: "user", content: userResponse });

    const { output, usage } = await callOpenAIParsed<TOutput>({
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
      usage,
    });

    if (!clarificationNeeded) {
      return output;
    }

    if (!clarificationMessage) {
      throw new MissingClarificationMessageError();
    }

    history.push({ role: "assistant", content: clarificationMessage });

    // Don't send clarification on the last attempt — no next turn to receive it.
    if (attempt < retries) {
      logger.debug("askWithClassify sending clarification", {
        clarificationMessage,
      });

      sendToUser(clarificationMessage);
    }
  }

  logger.warn("askWithClassify retries exhausted", { question });

  throw new RetriesExhaustedError(question, retries);
};
