import type { ReasoningEffort, ResponsesModel } from "openai/resources/shared";
import type { z } from "zod";

import type {
  AskWithClassifyBaseSchema,
  ClassifyErroredReasonEnum,
} from "#pipeline/ask-with-classify/ask-with-classify.schemas";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import type { PipelineStatus } from "#types/pipeline.types";

export type AskWithClassifyBase = z.infer<typeof AskWithClassifyBaseSchema>;

// Two-schema pattern: OpenAI structured outputs only accept a single z.object
// (no discriminated unions), so the model is given the loose `schema` with nullable
// domain fields. After convergence we re-validate against `resolvedSchema` (typically
// the loose one with only the post-convergence-required fields tightened to non-null)
// — failures surface as ClassifyOutputInvalidError instead of leaking a null downstream.
export type AskWithClassifyParams<
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
  // Total classification attempts = followUps + 1.
  followUps: number;
};

export type ClassifyErroredReason = z.infer<typeof ClassifyErroredReasonEnum>;

export type ClassifyUnresolvedResult<TReason extends string> = {
  status: Extract<PipelineStatus, "unresolved">;
  reason: TReason;
};

export type ClassifyErroredResult = {
  status: Extract<PipelineStatus, "errored">;
  reason: ClassifyErroredReason;
};
