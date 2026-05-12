import { z } from "zod";

import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

// Contribution is non-blocking by design — all classify-error modes collapse to
// `plansToContribute: false` inside the phase (mirrors ef-debt's safe-fallback
// pattern). The phase therefore has a single terminal status; no discriminated
// union needed.
export const ContributionPhaseResultSchema = z.object({
  status: PipelineStatusEnum.extract(["completed"]),
  plansToContribute: z.boolean(),
});
