import { z } from "zod";

export const GoalClassificationEnum = z.enum([
  "normal",
  "out_of_scope",
  "unrealistic",
  "contradictory",
]);

export const GoalClassificationSchema = z.object({
  type: GoalClassificationEnum,
});

export const IntakePhaseOutputSchema = z.object({
  accepted: z.boolean(),
});
