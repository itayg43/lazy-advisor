import type { z } from "zod";

import type { IntakePhaseOutputSchema } from "#pipeline/stages/clarify/intake/clarify.intake.schemas";

export type IntakePhaseOutput = z.infer<typeof IntakePhaseOutputSchema>;
