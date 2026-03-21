import type { Prisma } from "@prisma/client";

export type { Plan, Step, PlanStatus } from "@prisma/client";

export type PlanWithSteps = Prisma.PlanGetPayload<{
  include: {
    steps: true;
  };
}>;

export type UpdatePlanParams = Pick<Prisma.PlanUpdateInput, "goal" | "status">;

export type CreateStepParams = Pick<
  Prisma.StepUncheckedCreateInput,
  "planId" | "title" | "description" | "sortOrder"
>;

export type UpdateStepParams = Pick<
  Prisma.StepUpdateInput,
  "title" | "description" | "sortOrder"
>;
