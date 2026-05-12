import type { z } from "zod";

import type {
  RiskPhaseOutputSchema,
  RiskPhaseResultSchema,
} from "#pipeline/stages/clarify/risk/clarify.risk.schemas";

export type RiskPhaseOutput = z.infer<typeof RiskPhaseOutputSchema>;
export type RiskPhaseResult = z.infer<typeof RiskPhaseResultSchema>;
