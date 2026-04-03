import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaClient } from "#clients/prisma.client";
import * as stepRepository from "#repositories/step";
import { createStep, removeStep, updateStep } from "#services/step/step.service";
import type { CreateStepParams, Step, UpdateStepParams } from "#types/domain.types";

vi.mock("#repositories/step", () => ({
  createStep: vi.fn(),
  updateStep: vi.fn(),
  removeStep: vi.fn(),
}));

vi.mock("#clients/prisma.client", () => ({
  prismaClient: {},
}));

describe("stepService", () => {
  const mockedCreateStep = vi.mocked(stepRepository.createStep);
  const mockedUpdateStep = vi.mocked(stepRepository.updateStep);
  const mockedRemoveStep = vi.mocked(stepRepository.removeStep);

  const mockStep: Step = {
    id: 1,
    planId: 1,
    title: "Research global equity ETFs",
    description: "Compare VWRA and CSPX on expense ratio and tracking error",
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
