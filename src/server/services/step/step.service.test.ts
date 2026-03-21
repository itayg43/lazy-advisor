import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaClient } from "#server/clients/prisma.client";
import * as stepRepository from "#server/repositories/step";
import type {
  CreateStepParams,
  Step,
  UpdateStepParams,
} from "#server/types/domain.types";
import { createStep, removeStep, updateStep } from "./step.service";

vi.mock("#server/repositories/step", () => ({
  createStep: vi.fn(),
  updateStep: vi.fn(),
  removeStep: vi.fn(),
}));

vi.mock("#server/clients/prisma.client", () => ({
  prismaClient: {},
}));

describe("stepService", () => {
  const mockedCreateStep = vi.mocked(stepRepository.createStep);
  const mockedUpdateStep = vi.mocked(stepRepository.updateStep);
  const mockedRemoveStep = vi.mocked(stepRepository.removeStep);

  const mockStep: Step = {
    id: 1,
    planId: 1,
    title: "Research low-cost S&P 500 ETFs",
    description: "Compare VOO, SPY, and IVV on expense ratio and tracking error",
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createStep", () => {
    it("delegates to the repository with prismaClient and params", async () => {
      const params: CreateStepParams = {
        planId: mockStep.planId,
        title: mockStep.title,
        description: mockStep.description,
        sortOrder: mockStep.sortOrder,
      };
      mockedCreateStep.mockResolvedValue(mockStep);

      const result = await createStep(params);

      expect(mockedCreateStep).toHaveBeenCalledWith(prismaClient, params);
      expect(result).toBe(mockStep);
    });
  });

  describe("updateStep", () => {
    it("delegates to the repository with correct arguments", async () => {
      const updatedTitle = "Compare expense ratios across ETF providers";
      const params: UpdateStepParams = {
        title: updatedTitle,
      };
      const updatedStep: Step = {
        ...mockStep,
        title: updatedTitle,
      };
      mockedUpdateStep.mockResolvedValue(updatedStep);

      const result = await updateStep(mockStep.id, params);

      expect(mockedUpdateStep).toHaveBeenCalledWith(prismaClient, mockStep.id, params);
      expect(result).toBe(updatedStep);
    });
  });

  describe("removeStep", () => {
    it("delegates to the repository with correct arguments", async () => {
      mockedRemoveStep.mockResolvedValue(mockStep);

      const result = await removeStep(mockStep.id);

      expect(mockedRemoveStep).toHaveBeenCalledWith(prismaClient, mockStep.id);
      expect(result).toBe(mockStep);
    });
  });
});
