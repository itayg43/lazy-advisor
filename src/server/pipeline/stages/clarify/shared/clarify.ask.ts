import { zodTextFormat } from "openai/helpers/zod";
import type { EasyInputMessage } from "openai/resources/responses/responses";
import type { ReasoningEffort, ResponsesModel } from "openai/resources/shared";
import { z, type ZodError } from "zod";

import { InternalError, SchemaValidationError } from "#errors";
import { createLogger } from "#lib/logger";
import { ClarifyErroredReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  ClarifyErroredReason,
  ClarifyUnresolvedReason,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { Responder } from "#pipeline/tools/ask-user.tool";
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

export class ClassifyOutputInvalidError extends SchemaValidationError {
  constructor(cause: ZodError) {
    super("askWithClassify: classify output failed resolved-schema validation", cause);
    this.name = "ClassifyOutputInvalidError";
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

// Result shapes returned by mapClassifyError. The unresolved arm is generic so the
// caller-supplied reason preserves its literal type and fits the caller's
// `Extract<ClarifyUnresolvedReason, "...">` arm.
export type ClassifyUnresolvedResult<TReason extends ClarifyUnresolvedReason> = {
  status: Extract<PipelineStatus, "unresolved">;
  reason: TReason;
};

export type ClassifyErroredResult = {
  status: Extract<PipelineStatus, "errored">;
  reason: ClarifyErroredReason;
};

// Maps any ClassifyError to its phase-result counterpart and emits the log.
// Caller gates with isClassifyError; non-classify errors never reach here.
export const mapClassifyError = <TReason extends ClarifyUnresolvedReason>(
  error: ClassifyError,
  caller: string,
  unresolvedReason: TReason,
): ClassifyUnresolvedResult<TReason> | ClassifyErroredResult => {
  if (error instanceof ClassifyFollowUpsExhaustedError) {
    logger.info(`${caller} — follow-ups exhausted`);

    return { status: PipelineStatusEnum.enum.unresolved, reason: unresolvedReason };
  }
  if (error instanceof ClassifyOutputInvalidError) {
    logger.error(`${caller} — classify output invalid`, error, { cause: error.cause });

    return {
      status: PipelineStatusEnum.enum.errored,
      reason: ClarifyErroredReasonEnum.enum.classify_output_invalid,
    };
  }
  if (error instanceof ClassifyMessageMissingError) {
    logger.error(`${caller} — classify message missing`, error);

    return {
      status: PipelineStatusEnum.enum.errored,
      reason: ClarifyErroredReasonEnum.enum.classify_message_missing,
    };
  }

  // Compile-time exhaustiveness: adding a new ClassifyError member without a
  // handler above narrows `error` to a non-never type and fails this assignment.
  const _exhaustive: never = error;

  throw new InternalError(`Unhandled ClassifyError: ${String(_exhaustive)}`);
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
  responder: Responder;
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
