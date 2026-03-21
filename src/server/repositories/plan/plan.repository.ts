import type { PrismaClient } from "@prisma/client";

import type { Plan, PlanWithSteps, UpdatePlanParams } from "#server/types/domain.types";

export const createPlan = async (prisma: PrismaClient, goal: string): Promise<Plan> => {
  return prisma.plan.create({
    data: {
      goal,
    },
  });
};

export const getPlanWithSteps = async (
  prisma: PrismaClient,
  planId: number,
): Promise<PlanWithSteps | null> => {
  return prisma.plan.findUnique({
    where: {
      id: planId,
    },
    include: {
      steps: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  });
};

export const updatePlan = async (
  prisma: PrismaClient,
  planId: number,
  params: UpdatePlanParams,
): Promise<Plan> => {
  return prisma.plan.update({
    where: {
      id: planId,
    },
    data: params,
  });
};
