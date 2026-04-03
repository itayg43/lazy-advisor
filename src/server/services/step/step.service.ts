import { prismaClient } from "#clients/prisma.client";
import * as stepRepository from "#repositories/step";
import type { CreateStepParams, Step, UpdateStepParams } from "#types/domain.types";

export const createStep = async (params: CreateStepParams): Promise<Step> => {
  return stepRepository.createStep(prismaClient, params);
};

export const updateStep = async (
  stepId: number,
  params: UpdateStepParams,
): Promise<Step> => {
  return stepRepository.updateStep(prismaClient, stepId, params);
};

export const removeStep = async (stepId: number): Promise<Step> => {
  return stepRepository.removeStep(prismaClient, stepId);
};
