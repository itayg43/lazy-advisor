import type { z } from "zod";

import type {
  AllocationPhaseOutputSchema,
  AllocationPhaseResultSchema,
} from "#pipeline/stages/clarify/allocation/clarify.allocation.schemas";

export type AllocationPhaseOutput = z.infer<typeof AllocationPhaseOutputSchema>;
export type AllocationPhaseResult = z.infer<typeof AllocationPhaseResultSchema>;
