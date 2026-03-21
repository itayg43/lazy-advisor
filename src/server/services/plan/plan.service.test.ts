import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaClient } from "#server/clients/prisma.client";
import { NotFoundError } from "#server/errors";
import * as planRepository from "#server/repositories/plan";
import {
  PlanStatus,
  type Plan,
  type PlanWithSteps,
  type UpdatePlanParams,
} from "#server/types/domain.types";
import { createPlan, getPlanWithSteps, updatePlan } from "./plan.service";

vi.mock("#server/repositories/plan", () => ({
  createPlan: vi.fn(),
  getPlanWithSteps: vi.fn(),
  updatePlan: vi.fn(),
}));

vi.mock("#server/clients/prisma.client", () => ({
  prismaClient: {},
}));

describe("planService", () => {
  const mockedCreatePlan = vi.mocked(planRepository.createPlan);
  const mockedGetPlanWithSteps = vi.mocked(planRepository.getPlanWithSteps);
  const mockedUpdatePlan = vi.mocked(planRepository.updatePlan);

  const mockPlan: Plan = {
    id: 1,
    goal: "Build a diversified ETF portfolio for retirement",
    status: PlanStatus.draft,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPlan", () => {
    it("delegates to the repository with prismaClient and goal", async () => {
      mockedCreatePlan.mockResolvedValue(mockPlan);

      const result = await createPlan(mockPlan.goal);

      expect(mockedCreatePlan).toHaveBeenCalledWith(prismaClient, mockPlan.goal);
      expect(result).toBe(mockPlan);
    });
  });

  describe("getPlanWithSteps", () => {
    it("returns the plan when found", async () => {
      const mockPlanWithSteps: PlanWithSteps = {
        ...mockPlan,
        steps: [],
      };
      mockedGetPlanWithSteps.mockResolvedValue(mockPlanWithSteps);

      const result = await getPlanWithSteps(mockPlan.id);

      expect(mockedGetPlanWithSteps).toHaveBeenCalledWith(prismaClient, mockPlan.id);
      expect(result).toBe(mockPlanWithSteps);
    });

    it("throws NotFoundError when the plan does not exist", async () => {
      mockedGetPlanWithSteps.mockResolvedValue(null);

      await expect(getPlanWithSteps(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe("updatePlan", () => {
    it("delegates to the repository with correct arguments", async () => {
      const updatedGoal = "Start with low-cost index funds for long-term growth";
      const params: UpdatePlanParams = {
        goal: updatedGoal,
      };
      const updatedPlan: Plan = {
        ...mockPlan,
        goal: updatedGoal,
      };
      mockedUpdatePlan.mockResolvedValue(updatedPlan);

      const result = await updatePlan(mockPlan.id, params);

      expect(mockedUpdatePlan).toHaveBeenCalledWith(prismaClient, mockPlan.id, params);
      expect(result).toBe(updatedPlan);
    });
  });
});
