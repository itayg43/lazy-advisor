import type { AllocationPlan } from "#types/pipeline.types";

export const buildAllocationSummary = (plan: AllocationPlan): string => {
  return plan.slices
    .map((currSlice) => `- ${currSlice.category}: ${currSlice.percentage}%`)
    .join("\n");
};
