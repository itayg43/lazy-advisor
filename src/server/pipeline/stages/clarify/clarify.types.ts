import type { z } from "zod";

import type {
  ContributionPhaseOutputSchema,
  FieldsPhaseOutputSchema,
  PreferencesPhaseOutputSchema,
  RiskPhaseOutputSchema,
} from "#pipeline/stages/clarify/clarify.schemas";

export type FieldsPhaseOutput = z.infer<typeof FieldsPhaseOutputSchema>;
export type ContributionPhaseOutput = z.infer<typeof ContributionPhaseOutputSchema>;
export type RiskPhaseOutput = z.infer<typeof RiskPhaseOutputSchema>;
export type PreferencesPhaseOutput = z.infer<typeof PreferencesPhaseOutputSchema>;
