import { z } from "zod";

import { AskWithClassifyBaseSchema } from "#pipeline/ask-with-classify";

const AnswerSchema = z.enum(["yes", "no"]);

export const ContributionClassifySchema = AskWithClassifyBaseSchema.extend({
  answer: AnswerSchema.nullable(),
});

export const ContributionClassifyResolvedSchema = ContributionClassifySchema.extend({
  answer: AnswerSchema,
});

// Contribution is non-blocking by design — all classify-error modes collapse to
// `plansToContribute: false` inside the phase (mirrors ef-debt's safe-fallback
// pattern). The phase always produces a value, so its result carries no status:
// unlike sibling phases it can't terminate the stage.
export const ContributionPhaseResultSchema = z.object({
  plansToContribute: z.boolean(),
});
