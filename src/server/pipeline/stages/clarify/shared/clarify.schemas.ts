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

// Legacy (ask-with-classify) unresolved reasons, where the reason *is* the phase
// name. `allocation` is absent: allocation is on the runConversation shape and
// self-reports a granular reason, with the stage attaching `phase` (below) instead.
export const ClarifyUnresolvedReasonEnum = z.enum([
  "amount",
  "timeline",
  "risk_tolerance",
]);

// Which phase produced a result carrying a granular, phase-owned reason (unresolved
// or errored). Stage-owned discriminant: the phase reports *why*, the stage attaches
// *which*. Grows as phases migrate to the runConversation shape; allocation is first.
export const ClarifyPhaseEnum = z.enum(["allocation"]);

export const ClarifyHaltReasonEnum = z.enum(["short_timeline", "intake_rejected"]);
