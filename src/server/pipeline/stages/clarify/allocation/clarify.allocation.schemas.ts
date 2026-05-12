import { z } from "zod";

import { ClarifyUnresolvedReasonEnum } from "#pipeline/stages/clarify/shared/clarify.schemas";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

export const AllocationPhaseOutputSchema = z
  .object({
    equityPercentage: z.number().int().min(0).max(100),
    bufferPercentage: z.number().int().min(0).max(100),
  })
  .refine((v) => v.equityPercentage + v.bufferPercentage === 100, {
    message: "equityPercentage + bufferPercentage must equal 100",
  });

export const AllocationPhaseResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: PipelineStatusEnum.extract(["completed"]),
    allocation: AllocationPhaseOutputSchema,
  }),
  z.object({
    status: PipelineStatusEnum.extract(["unresolved"]),
    reason: ClarifyUnresolvedReasonEnum.extract(["allocation"]),
  }),
]);
