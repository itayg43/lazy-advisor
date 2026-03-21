import type { PrismaClient } from "@prisma/client";

import type {
  CreateStepParams,
  Step,
  UpdateStepParams,
} from "#server/types/domain.types.js";

export const createStep = async (
  prisma: PrismaClient,
  params: CreateStepParams,
): Promise<Step> => {
  return prisma.step.create({
    data: params,
  });
};

export const updateStep = async (
  prisma: PrismaClient,
  stepId: number,
  params: UpdateStepParams,
): Promise<Step> => {
  return prisma.step.update({
    where: {
      id: stepId,
    },
    data: params,
  });
};

export const removeStep = async (prisma: PrismaClient, stepId: number): Promise<Step> => {
  return prisma.step.delete({
    where: {
      id: stepId,
    },
  });
};
