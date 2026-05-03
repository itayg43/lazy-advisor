import { zodTextFormat } from "openai/helpers/zod";
import type { EasyInputMessage } from "openai/resources/responses/responses";
import type { ReasoningEffort, ResponsesModel } from "openai/resources/shared";
import { z } from "zod";

import { createLogger } from "#lib/logger";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("clarifyAsk");

const ASK_WITH_CLASSIFY_DEFAULT_RETRIES = 2;

type AskWithClassifyResult<TOutput> =
  | { status: "success"; output: TOutput }
  | { status: "failure"; code: "retries_exhausted" };

export const AskWithClassifyBaseSchema = z.object({
  clarificationNeeded: z.boolean(),
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
  retries?: number;
};

export const askWithClassify = async <TOutput extends AskWithClassifyBase>(
  params: AskWithClassifyParams<TOutput>,
): Promise<AskWithClassifyResult<TOutput>> => {
  const {
    question,
    classifyInstructions,
    schema,
    sendToUser,
    waitForResponse,
    model,
    effort,
    retries = ASK_WITH_CLASSIFY_DEFAULT_RETRIES,
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
      return { status: "success", output };
    }

    if (clarificationMessage) {
      logger.debug("askWithClassify sending clarification", {
        clarificationMessage,
      });

      sendToUser(clarificationMessage);
      history.push({ role: "assistant", content: clarificationMessage });
    }
  }

  logger.warn("askWithClassify retries exhausted", { question });

  return { status: "failure", code: "retries_exhausted" };
};
