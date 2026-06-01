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

// How a user's turn is classified. `accept` resolves to the *current* proposal
// (anchor if untouched, latest counter otherwise). `accept-original` is a
// retraction-shaped acceptance — after one or more counters, the user signals
// they want to go back to the initial anchor without naming a number (e.g.,
// "stick with your original suggestion"); the handler routes it to the anchor
// equity, not the latest counter.
export const AllocationIntentKindEnum = z.enum([
  "accept",
  "accept-original",
  "counter",
  "question",
  "unknown",
]);

// Which reply to compose for a counter-proposal, in priority order. `extreme`:
// the proposal deviates past the threshold from the recommended range and the
// extreme sanity-check framing hasn't been shown yet. `compound-impact`: show
// the long-run compounding trade-off framing (when not extreme, or extreme
// already shown). `bare`: both framings already shown — acknowledge the counter
// without re-framing. Selected in `selectCounterBranch`.
export const AllocationCounterBranchKindEnum = z.enum([
  "extreme",
  "compound-impact",
  "bare",
]);

export const AllocationExtremeCounterDirectionEnum = z.enum(["too-high", "too-low"]);

// Classifier output. Flat shape (not a discriminated union) because OpenAI
// structured outputs don't accept z.discriminatedUnion — same pattern as the
// askWithClassify two-schema setup. `proposedEquityPercentage` is meaningful
// only when `kind === "counter"`; nullable otherwise.
export const AllocationClassifierOutputSchema = z.object({
  kind: AllocationIntentKindEnum,
  proposedEquityPercentage: z.number().int().min(0).max(100).nullable(),
});

// Composer schemas — wrap free-text replies in a single `reply` field so we
// can keep using callOpenAIParsed (consistent with the rest of the codebase).
export const AllocationComposerOutputSchema = z.object({
  reply: z.string().min(1),
});
