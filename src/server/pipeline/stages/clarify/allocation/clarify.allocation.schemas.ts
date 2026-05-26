import { z } from "zod";

import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

// Base object shape — split out so it can be merged into the result schema's
// completed variant. `.refine()` produces a `ZodEffects`, which `z.merge()` and
// `z.discriminatedUnion()` reject; the unrefined shape is reusable.
const AllocationPhaseOutputShape = z.object({
  equityPercentage: z.number().int().min(0).max(100),
  bufferPercentage: z.number().int().min(0).max(100),
});

const equityBufferSumsTo100 = (v: {
  equityPercentage: number;
  bufferPercentage: number;
}) => v.equityPercentage + v.bufferPercentage === 100;

const SUM_TO_100_ERROR = {
  message: "equityPercentage + bufferPercentage must equal 100",
};

export const AllocationPhaseOutputSchema = AllocationPhaseOutputShape.refine(
  equityBufferSumsTo100,
  SUM_TO_100_ERROR,
);

export const AllocationPhaseResultSchema = z
  .discriminatedUnion("status", [
    z
      .object({ status: PipelineStatusEnum.extract(["completed"]) })
      .merge(AllocationPhaseOutputShape),
    z.object({
      status: PipelineStatusEnum.extract(["unresolved"]),
      reason: ClarifyUnresolvedReasonEnum.extract(["allocation"]),
    }),
  ])
  .refine((v) => v.status !== "completed" || equityBufferSumsTo100(v), SUM_TO_100_ERROR);

// Classifier output. Flat shape (not a discriminated union) because OpenAI
// structured outputs don't accept z.discriminatedUnion — same pattern as the
// askWithClassify two-schema setup. `proposedEquity` is meaningful only when
// `kind === "counter"`; nullable otherwise.
export const AllocationIntentKindEnum = z.enum([
  "accept",
  "counter",
  "question",
  "unknown",
]);

export const AllocationClassifierOutputSchema = z.object({
  kind: AllocationIntentKindEnum,
  proposedEquity: z.number().int().min(0).max(100).nullable(),
});

// Composer schemas — wrap free-text replies in a single `reply` field so we
// can keep using callOpenAIParsed (consistent with the rest of the codebase).
export const AllocationComposerOutputSchema = z.object({
  reply: z.string().min(1),
});
