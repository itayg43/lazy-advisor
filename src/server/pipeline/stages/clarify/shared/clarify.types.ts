import type { z } from "zod";

import type {
  AllocationPhaseOutputSchema,
  ContributionPhaseOutputSchema,
  FieldsPhaseOutputSchema,
  RiskPhaseOutputSchema,
  RiskScoreSchema,
} from "#pipeline/stages/clarify/shared/clarify.schemas";

export type FieldsPhaseOutput = z.infer<typeof FieldsPhaseOutputSchema>;
export type RiskScore = z.infer<typeof RiskScoreSchema>;
export type RiskPhaseOutput = z.infer<typeof RiskPhaseOutputSchema>;
export type AllocationPhaseOutput = z.infer<typeof AllocationPhaseOutputSchema>;
export type ContributionPhaseOutput = z.infer<typeof ContributionPhaseOutputSchema>;
