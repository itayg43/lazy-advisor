import type { z } from "zod";

import type { ContributionPhaseResultSchema } from "#pipeline/stages/clarify/contribution/clarify.contribution.schemas";

export type ContributionPhaseResult = z.infer<typeof ContributionPhaseResultSchema>;
