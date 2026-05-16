import type { ZodError } from "zod";

import { InternalError, SchemaValidationError } from "#errors";
import { createLogger } from "#lib/logger";
import { ClassifyErroredReasonEnum } from "#pipeline/ask-with-classify/ask-with-classify.schemas";
import type {
  ClassifyErroredResult,
  ClassifyUnresolvedResult,
} from "#pipeline/ask-with-classify/ask-with-classify.types";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const logger = createLogger("askWithClassify");

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

// Maps any ClassifyError to its phase-result counterpart and emits the log.
// Caller gates with isClassifyError; non-classify errors never reach here.
export const mapClassifyError = <TReason extends string>(
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
      reason: ClassifyErroredReasonEnum.enum.classify_output_invalid,
    };
  }
  if (error instanceof ClassifyMessageMissingError) {
    logger.error(`${caller} — classify message missing`, error);

    return {
      status: PipelineStatusEnum.enum.errored,
      reason: ClassifyErroredReasonEnum.enum.classify_message_missing,
    };
  }

  // Compile-time exhaustiveness: adding a new ClassifyError member without a
  // handler above narrows `error` to a non-never type and fails this assignment.
  const _exhaustive: never = error;

  throw new InternalError(`Unhandled ClassifyError: ${String(_exhaustive)}`);
};
