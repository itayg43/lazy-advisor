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

export const ClarifyUnresolvedReasonEnum = z.enum([
  "amount",
  "timeline",
  "risk_tolerance",
  "allocation",
]);

export const ClarifyHaltReasonEnum = z.enum(["short_timeline", "intake_rejected"]);

export const ClarifyErroredReasonEnum = z.enum([
  "classify_output_invalid",
  "classify_message_missing",
]);
