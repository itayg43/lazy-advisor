import type { z } from "zod";

import type {
  AllocationPhaseOutputSchema,
  ContributionPhaseOutputSchema,
  ParametersExtractionSchema,
  ParametersPhaseOutputSchema,
  ParametersPhaseResultSchema,
  IntakePhaseOutputSchema,
  RiskPhaseOutputSchema,
  RiskScoreSchema,
} from "#pipeline/stages/clarify/shared/clarify.schemas";

export type IntakePhaseOutput = z.infer<typeof IntakePhaseOutputSchema>;
export type ParametersPhaseOutput = z.infer<typeof ParametersPhaseOutputSchema>;
export type ParametersExtraction = z.infer<typeof ParametersExtractionSchema>;
export type ParametersPhaseResult = z.infer<typeof ParametersPhaseResultSchema>;
export type RiskScore = z.infer<typeof RiskScoreSchema>;
export type RiskPhaseOutput = z.infer<typeof RiskPhaseOutputSchema>;
export type AllocationPhaseOutput = z.infer<typeof AllocationPhaseOutputSchema>;
export type ContributionPhaseOutput = z.infer<typeof ContributionPhaseOutputSchema>;
