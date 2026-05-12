import { z } from "zod";

export const IntakePhaseOutputSchema = z.object({
  accepted: z.boolean(),
});
