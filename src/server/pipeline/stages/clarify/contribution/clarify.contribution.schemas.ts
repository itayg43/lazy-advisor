import { z } from "zod";

import { AskWithClassifyBaseSchema } from "#pipeline/stages/clarify/shared/clarify.ask";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

const AnswerSchema = z.enum(["yes", "no"]);

export const ContributionClassifySchema = AskWithClassifyBaseSchema.extend({
  answer: AnswerSchema.nullable(),
});

export const ContributionClassifyResolvedSchema = ContributionClassifySchema.extend({
  answer: AnswerSchema,
});

// Contribution is non-blocking by design — all classify-error modes collapse to
// `plansToContribute: false` inside the phase (mirrors ef-debt's safe-fallback
// pattern). The phase therefore has a single terminal status; no discriminated
// union needed.
export const ContributionPhaseResultSchema = z.object({
  status: PipelineStatusEnum.extract(["completed"]),
  plansToContribute: z.boolean(),
});
