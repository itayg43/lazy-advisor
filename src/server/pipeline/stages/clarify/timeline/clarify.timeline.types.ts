import type { z } from "zod";

import type {
  TimelineClassifySchema,
  TimelinePhaseResultSchema,
} from "#pipeline/stages/clarify/timeline/clarify.timeline.schemas";

export type TimelineClassify = z.infer<typeof TimelineClassifySchema>;
export type TimelinePhaseResult = z.infer<typeof TimelinePhaseResultSchema>;
