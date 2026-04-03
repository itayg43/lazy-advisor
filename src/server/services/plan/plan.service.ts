import { NotFoundError } from "#errors";

import { prismaClient } from "#clients/prisma.client";
import * as planRepository from "#repositories/plan";
import type { Plan, PlanWithSteps, UpdatePlanParams } from "#types/domain.types";

export const createPlan = async (goal: string): Promise<Plan> => {
  return planRepository.createPlan(prismaClient, goal);
};

export const getPlanWithSteps = async (planId: number): Promise<PlanWithSteps> => {
  const plan = await planRepository.getPlanWithSteps(prismaClient, planId);

  if (!plan) {
    throw new NotFoundError(`Plan with id ${planId} not found`);
  }

  return plan;
};

export const updatePlan = async (
  planId: number,
  params: UpdatePlanParams,
): Promise<Plan> => {
  return planRepository.updatePlan(prismaClient, planId, params);
};
