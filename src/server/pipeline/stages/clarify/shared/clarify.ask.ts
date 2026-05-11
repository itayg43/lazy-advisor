import { zodTextFormat } from "openai/helpers/zod";
import type { EasyInputMessage } from "openai/resources/responses/responses";
import type { ReasoningEffort, ResponsesModel } from "openai/resources/shared";
import { z, type ZodError } from "zod";

import { InternalError } from "#errors";
import { createLogger } from "#lib/logger";
import { ClarifyErroredReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  ClarifyErroredReason,
  ClarifyUnresolvedReason,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";
import { callOpenAIParsed } from "#services/openai";
import type { PipelineStatus } from "#types/pipeline.types";

const logger = createLogger("clarifyAsk");

export class ClassifyFollowUpsExhaustedError extends InternalError {
  constructor(question: string, followUps: number) {
    super(
      `askWithClassify failed to converge after ${followUps + 1} attempts for: "${question}"`,
    );
    this.name = "ClassifyFollowUpsExhaustedError";
  }
}

export class ClassifyMessageMissingError extends InternalError {
  constructor() {
    super("askWithClassify: clarificationNeeded=true but clarificationMessage is null");
    this.name = "ClassifyMessageMissingError";
  }
}

export class ClassifyOutputInvalidError extends InternalError {
  readonly cause: ZodError;

  constructor(cause: ZodError) {
    super("askWithClassify: classify output failed resolved-schema validation");
    this.name = "ClassifyOutputInvalidError";
    this.cause = cause;
  }
}

export type ClassifyError =
  | ClassifyFollowUpsExhaustedError
  | ClassifyMessageMissingError
  | ClassifyOutputInvalidError;

export const isClassifyError = (error: unknown): error is ClassifyError =>
  error instanceof ClassifyFollowUpsExhaustedError ||
  error instanceof ClassifyMessageMissingError ||
  error instanceof ClassifyOutputInvalidError;

// Maps ClassifyFollowUpsExhaustedError to an unresolved phase-result and emits the log.
// The reason is the caller's responsibility — generic preserves the literal narrowing
// so the result fits caller-side `Extract<ClarifyUnresolvedReason, "...">` arms.
export type ClassifyUnresolvedResult<TReason extends ClarifyUnresolvedReason> = {
  status: Extract<PipelineStatus, "unresolved">;
  reason: TReason;
};

export const mapClassifyErrorToUnresolved = <TReason extends ClarifyUnresolvedReason>(
  error: unknown,
  label: string,
  reason: TReason,
): ClassifyUnresolvedResult<TReason> | null => {
  if (error instanceof ClassifyFollowUpsExhaustedError) {
    logger.info(`${label} — follow-ups exhausted`);

    return { status: PipelineStatusEnum.enum.unresolved, reason };
  }

  return null;
};

// Maps the two system-driven classify errors (output-invalid, message-missing)
// to an errored phase-result and emits the log. Returns null for everything else
// (including ClassifyFollowUpsExhaustedError) — callers decide what to do.
export type ClassifyErroredResult = {
  status: Extract<PipelineStatus, "errored">;
  reason: ClarifyErroredReason;
};

export const mapClassifyErrorToErrored = (
  error: unknown,
  label: string,
): ClassifyErroredResult | null => {
  if (error instanceof ClassifyOutputInvalidError) {
    logger.error(`${label} — classify output invalid`, error, { cause: error.cause });

    return {
      status: PipelineStatusEnum.enum.errored,
      reason: ClarifyErroredReasonEnum.enum.classify_output_invalid,
    };
  }
  if (error instanceof ClassifyMessageMissingError) {
    logger.error(`${label} — classify message missing`, error);

    return {
      status: PipelineStatusEnum.enum.errored,
      reason: ClarifyErroredReasonEnum.enum.classify_message_missing,
    };
  }

  return null;
};

export const AskWithClassifyBaseSchema = z.object({
  clarificationNeeded: z.boolean(),
  // Must be non-null when clarificationNeeded is true — enforced by instructions only.
  // A discriminated union would express this structurally, but zodTextFormat doesn't support oneOf yet.
  clarificationMessage: z.string().nullable(),
});

type AskWithClassifyBase = z.infer<typeof AskWithClassifyBaseSchema>;

// Two-schema pattern: OpenAI structured outputs only accept a single z.object
// (no discriminated unions), so the model is given the loose `schema` with nullable
// domain fields. After convergence we re-validate against `resolvedSchema` (typically
// the loose one with only the post-convergence-required fields tightened to non-null)
// — failures surface as ClassifyOutputInvalidError instead of leaking a null downstream.
type AskWithClassifyParams<
  TOutput extends AskWithClassifyBase,
  TResolved extends TOutput,
> = {
  question: string;
  classifyInstructions: string;
  schema: z.ZodType<TOutput>;
  resolvedSchema: z.ZodType<TResolved>;
  sendToUser: SendToUser;
  waitForResponse: WaitForResponse;
  model: ResponsesModel;
  effort: ReasoningEffort;
  // Number of follow-up clarification exchanges allowed before giving up.
  // Total classification attempts = followUps + 1 (the final attempt below the loop).
  followUps: number;
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

      return validateResolved(output, resolvedSchema);
    }

    if (!clarificationMessage) {
      throw new ClassifyMessageMissingError();
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

    return validateResolved(output, resolvedSchema);
  }

  logger.warn("askWithClassify follow-ups exhausted", { question });

  throw new ClassifyFollowUpsExhaustedError(question, followUps);
};

const validateResolved = <TOutput, TResolved extends TOutput>(
  output: TOutput,
  resolvedSchema: z.ZodType<TResolved>,
): TResolved => {
  const parsed = resolvedSchema.safeParse(output);
  if (!parsed.success) {
    throw new ClassifyOutputInvalidError(parsed.error);
  }

  return parsed.data;
};
