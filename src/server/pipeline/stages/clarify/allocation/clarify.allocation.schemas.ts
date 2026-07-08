import { z } from "zod";

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
    // Bare unresolved — no `reason`. The phase reports only that it couldn't
    // resolve; `runClarifyStage` attaches the stage-level reason (`allocation`),
    // since which phase failed is a stage concern, not a phase-internal one.
    z.object({
      status: PipelineStatusEnum.extract(["unresolved"]),
    }),
  ])
  .refine((v) => v.status !== "completed" || equityBufferSumsTo100(v), SUM_TO_100_ERROR);

/**
 * How a user's turn is classified. `accept` resolves to the *current* proposal
 * (anchor if untouched, latest counter otherwise). `accept-original` is a
 * retraction-shaped acceptance — after one or more counters, the user signals
 * they want to go back to the initial anchor without naming a number (e.g.,
 * "stick with your original suggestion"); the handler routes it to the anchor
 * equity, not the latest counter.
 */
export const AllocationIntentKindEnum = z.enum([
  "accept",
  "accept-original",
  "counter",
  "question",
  "unknown",
]);

/**
 * Which reply to compose for a counter-proposal, in priority order. `extreme`:
 * the proposal deviates past the threshold from the recommended range and the
 * extreme sanity-check framing hasn't been shown yet. `compound-impact`: show
 * the long-run compounding trade-off framing (when not extreme, or extreme
 * already shown). `bare`: both framings already shown — acknowledge the counter
 * without re-framing. Selected in `selectCounterBranch`.
 */
export const AllocationCounterBranchKindEnum = z.enum([
  "extreme",
  "compound-impact",
  "bare",
]);

export const AllocationExtremeCounterDirectionEnum = z.enum(["too-high", "too-low"]);

const AllocationProposedEquityPercentageSchema = z.number().int().min(0).max(100);

/**
 * Classifier output — the model-facing shape. Flat (not a discriminated union)
 * because OpenAI structured outputs don't accept z.discriminatedUnion;
 * `classifyTurn` re-parses it into the resolved `AllocationIntentSchema`. Same
 * two-schema split as askWithClassify. `proposedEquityPercentage` is meaningful
 * only when `kind === "counter"`; nullable otherwise.
 */
export const AllocationClassifierOutputSchema = z.object({
  kind: AllocationIntentKindEnum,
  proposedEquityPercentage: AllocationProposedEquityPercentageSchema.nullable().describe(
    'The user\'s equity percentage when kind is "counter" (buffer is implied as 100 − equity). null for every other intent.',
  ),
});

/**
 * Resolved intent — the internal contract, parsed from the flat classifier
 * output inside `classifyTurn`. A discriminated union makes the
 * "percentage iff counter" invariant real in the types: `counter` carries a
 * guaranteed number, every other intent drops the field (zod strips the
 * model's null). A `counter` with a null percentage fails this parse and
 * throws — the prompt routes numberless replies to `unknown`, so that shape is
 * model disobedience, surfaced rather than masked.
 *
 * Each kind is its own variant rather than collapsing the four non-counter
 * kinds into one `exclude(["counter"])` member: a collapsed member fuses the
 * accept kinds with question/unknown under a single `kind` union, and no type
 * operation can separate them again — so `AllocationContinuingIntent` (the
 * accept-free type `resolveAskDecision` consumes) can't be derived via
 * `Exclude`. Listing the variants keeps each kind independently extractable.
 */
export const AllocationIntentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: AllocationIntentKindEnum.extract(["counter"]),
    proposedEquityPercentage: AllocationProposedEquityPercentageSchema,
  }),
  z.object({ kind: AllocationIntentKindEnum.extract(["accept"]) }),
  z.object({ kind: AllocationIntentKindEnum.extract(["accept-original"]) }),
  z.object({ kind: AllocationIntentKindEnum.extract(["question"]) }),
  z.object({ kind: AllocationIntentKindEnum.extract(["unknown"]) }),
]);

/**
 * Composer output schema — wraps a free-text reply in a single `reply` field so
 * the composers can keep using callOpenAIParsed (consistent with the codebase).
 */
export const AllocationComposerOutputSchema = z.object({
  reply: z.string().min(1),
});
