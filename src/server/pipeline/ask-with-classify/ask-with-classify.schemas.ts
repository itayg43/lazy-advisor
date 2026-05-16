import { z } from "zod";

export const AskWithClassifyBaseSchema = z.object({
  clarificationNeeded: z.boolean(),
  // Must be non-null when clarificationNeeded is true — enforced by instructions only.
  // A discriminated union would express this structurally, but zodTextFormat doesn't support oneOf yet.
  clarificationMessage: z.string().nullable(),
});

export const ClassifyErroredReasonEnum = z.enum([
  "classify_resolved_output_invalid",
  "classify_message_missing",
]);
