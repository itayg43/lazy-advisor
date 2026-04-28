import type { z } from "zod";

import type {
  AllocationPhaseOutputSchema,
  ContributionPhaseOutputSchema,
  FieldsExtractionSchema,
  FieldsPhaseOutputSchema,
  FieldsPhaseResultSchema,
  IntakePhaseOutputSchema,
  RiskPhaseOutputSchema,
  RiskScoreSchema,
} from "#pipeline/stages/clarify/shared/clarify.schemas";

export type IntakePhaseOutput = z.infer<typeof IntakePhaseOutputSchema>;
export type FieldsPhaseOutput = z.infer<typeof FieldsPhaseOutputSchema>;
export type FieldsExtraction = z.infer<typeof FieldsExtractionSchema>;
export type FieldsPhaseResult = z.infer<typeof FieldsPhaseResultSchema>;
export type RiskScore = z.infer<typeof RiskScoreSchema>;
export type RiskPhaseOutput = z.infer<typeof RiskPhaseOutputSchema>;
export type AllocationPhaseOutput = z.infer<typeof AllocationPhaseOutputSchema>;
export type ContributionPhaseOutput = z.infer<typeof ContributionPhaseOutputSchema>;
