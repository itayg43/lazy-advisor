import type { z } from "zod";

import type {
  GoalClassificationEnum,
  GoalClassificationSchema,
  IntakePhaseOutputSchema,
} from "#pipeline/stages/clarify/intake/clarify.intake.schemas";

export type GoalClassification = z.infer<typeof GoalClassificationEnum>;
export type GoalClassificationOutput = z.infer<typeof GoalClassificationSchema>;
export type RedirectingClassification = Exclude<GoalClassification, "normal">;

export type IntakePhaseOutput = z.infer<typeof IntakePhaseOutputSchema>;
