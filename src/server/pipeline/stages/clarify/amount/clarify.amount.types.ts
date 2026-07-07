import type { z } from "zod";

import type {
  AmountClassifySchema,
  AmountPhaseResultSchema,
} from "#pipeline/stages/clarify/amount/clarify.amount.schemas";

export type AmountClassify = z.infer<typeof AmountClassifySchema>;
export type AmountPhaseResult = z.infer<typeof AmountPhaseResultSchema>;
