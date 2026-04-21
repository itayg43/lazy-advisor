import type { z } from "zod";

import type {
  ContributionPhaseOutputSchema,
  FieldsPhaseOutputSchema,
  PreferencesPhaseOutputSchema,
  RiskPhaseOutputSchema,
  RiskScoreSchema,
} from "#pipeline/stages/clarify/shared/clarify.schemas";

export type FieldsPhaseOutput = z.infer<typeof FieldsPhaseOutputSchema>;
export type RiskScore = z.infer<typeof RiskScoreSchema>;
export type RiskPhaseOutput = z.infer<typeof RiskPhaseOutputSchema>;
export type ContributionPhaseOutput = z.infer<typeof ContributionPhaseOutputSchema>;
export type PreferencesPhaseOutput = z.infer<typeof PreferencesPhaseOutputSchema>;
