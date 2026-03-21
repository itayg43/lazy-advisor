import type { Prisma } from "@prisma/client";

export type { Plan, Step, PlanStatus } from "@prisma/client";

export type PlanWithSteps = Prisma.PlanGetPayload<{
  include: {
    steps: true;
  };
}>;
