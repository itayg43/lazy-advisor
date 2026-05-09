import type { z } from "zod";

import type {
  AllocationPhaseOutputSchema,
  AllocationPhaseResultSchema,
  ContributionPhaseOutputSchema,
  ParametersPhaseOutputSchema,
  ParametersPhaseResultSchema,
  IntakePhaseOutputSchema,
  RiskPhaseOutputSchema,
  RiskPhaseResultSchema,
  RiskScoreSchema,
} from "#pipeline/stages/clarify/shared/clarify.schemas";

export type IntakePhaseOutput = z.infer<typeof IntakePhaseOutputSchema>;
export type ParametersPhaseOutput = z.infer<typeof ParametersPhaseOutputSchema>;
export type ParametersPhaseResult = z.infer<typeof ParametersPhaseResultSchema>;
export type RiskScore = z.infer<typeof RiskScoreSchema>;
export type RiskPhaseOutput = z.infer<typeof RiskPhaseOutputSchema>;
export type RiskPhaseResult = z.infer<typeof RiskPhaseResultSchema>;
export type AllocationPhaseOutput = z.infer<typeof AllocationPhaseOutputSchema>;
export type AllocationPhaseResult = z.infer<typeof AllocationPhaseResultSchema>;
export type ContributionPhaseOutput = z.infer<typeof ContributionPhaseOutputSchema>;
