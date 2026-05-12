import type { z } from "zod";

import type {
  ContributionClassifySchema,
  ContributionPhaseResultSchema,
} from "#pipeline/stages/clarify/contribution/clarify.contribution.schemas";

export type ContributionPhaseResult = z.infer<typeof ContributionPhaseResultSchema>;

export type ContributionClassify = z.infer<typeof ContributionClassifySchema>;
