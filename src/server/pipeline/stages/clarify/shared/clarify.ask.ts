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
  // Must be non-null when clarificationNeeded is true — enforced by instructions only.
  // A discriminated union would express this structurally, but zodTextFormat doesn't support oneOf yet.
  clarificationMessage: z.string().nullable(),
});

type AskWithClassifyBase = z.infer<typeof AskWithClassifyBaseSchema>;

type ClassifyInstructionExample = {
  userInput: string;
  clarificationNeeded: boolean;
  note: string;
};

type BuildClassifyInstructionsParams = {
  question: string;
  answerOptions: { value: string; description: string }[];
  keyFacts: string;
  examples?: ClassifyInstructionExample[];
};

export const buildClassifyInstructions = ({
  question,
  answerOptions,
  keyFacts,
  examples,
}: BuildClassifyInstructionsParams): string => {
  const answerRules = answerOptions
    .map(({ value, description }) => `- "${value}" — ${description}`)
    .join("\n");

  const examplesSection =
    examples && examples.length > 0
      ? [
          "",
          "# Examples",
          "",
          ...examples.map(
            ({ userInput, clarificationNeeded, note }) =>
              `User: "${userInput}"\n→ clarificationNeeded: ${clarificationNeeded} — ${note}`,
          ),
        ].join("\n")
      : "";

  return `# Role and Objective
You are classifying a user's response to: "${question}"
Populate the three output fields based on the rules below.

# Output Rules

**answer**
${answerRules}
- null  — when clarificationNeeded is true

**clarificationNeeded**
- true — user asked a question instead of answering (e.g. "what does that mean?", "can you explain?")
- true — user gave an ambiguous or unclear answer (e.g. "I have some savings", "kind of?")
- true — user deflected or went off-topic (e.g. "skip this", "I don't want to answer")
- true — user gave an answer but also asked a follow-up question (e.g. "Yes, but does X count?")
- false — user gave a clear yes or no

**clarificationMessage** (only when clarificationNeeded is true)
- Must be non-null when clarificationNeeded is true.
- Use the conversation history to understand what the user said or asked — tailor your response accordingly.
- If user asked a question: answer it directly using the key facts below
- If user gave an ambiguous answer: ask them to clarify
- If user deflected or went off-topic: redirect them back to the question
- If user gave an answer but also asked a question: answer their question first, then ask them to confirm their answer
- Key facts: ${keyFacts}
- Keep it to 1–2 sentences. Do not re-state the original question.${examplesSection}`;
};

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
