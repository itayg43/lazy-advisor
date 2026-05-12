import type { z } from "zod";

import type {
  ParametersPhaseOutputSchema,
  ParametersPhaseResultSchema,
} from "#pipeline/stages/clarify/parameters/clarify.parameters.schemas";

export type ParametersPhaseOutput = z.infer<typeof ParametersPhaseOutputSchema>;
export type ParametersPhaseResult = z.infer<typeof ParametersPhaseResultSchema>;
