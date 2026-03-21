import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { CreateStepParams } from "#server/types/domain.types";
import { createStep, removeStep, updateStep } from "./step.repository";

describe("stepRepository", () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prismaClient = new PrismaClient({
    adapter,
  });

  const mockPlanGoal = "Build a diversified ETF portfolio";

  beforeEach(async () => {
    await prismaClient.step.deleteMany();
    await prismaClient.plan.deleteMany();
  });

  afterAll(async () => {
    await prismaClient.$disconnect();
  });

  describe("createStep", () => {
    it("creates a step linked to a plan", async () => {
      const plan = await prismaClient.plan.create({
        data: {
          goal: mockPlanGoal,
        },
      });
      const params: CreateStepParams = {
        planId: plan.id,
        title: "Research low-cost S&P 500 ETFs",
        description: "Compare VOO, SPY, and IVV on expense ratio and tracking error",
        sortOrder: 1,
      };

      const step = await createStep(prismaClient, params);

      expect(step.planId).toBe(plan.id);
      expect(step.title).toBe(params.title);
      expect(step.description).toBe(params.description);
      expect(step.sortOrder).toBe(params.sortOrder);
      expect(step.id).toEqual(expect.any(Number));
    });
  });

  describe("updateStep", () => {
    it("updates the title and description", async () => {
      const plan = await prismaClient.plan.create({
        data: {
          goal: mockPlanGoal,
        },
      });
      const step = await createStep(prismaClient, {
        planId: plan.id,
        title: "Research bond ETFs",
        description: "Look at BND and AGG for fixed-income allocation",
        sortOrder: 1,
      });

      const updatedTitle = "Compare bond ETF expense ratios";
      const updatedDescription = "Focus on BND vs AGG total cost of ownership";
      const updated = await updateStep(prismaClient, step.id, {
        title: updatedTitle,
        description: updatedDescription,
      });

      expect(updated.title).toBe(updatedTitle);
      expect(updated.description).toBe(updatedDescription);
    });

    it("updates the sortOrder", async () => {
      const plan = await prismaClient.plan.create({
        data: {
          goal: mockPlanGoal,
        },
      });
      const step = await createStep(prismaClient, {
        planId: plan.id,
        title: "Set target asset allocation",
        description: "Decide on stock-to-bond ratio based on risk tolerance",
        sortOrder: 1,
      });

      const updated = await updateStep(prismaClient, step.id, {
        sortOrder: 5,
      });

      expect(updated.sortOrder).toBe(5);
    });
  });

  describe("removeStep", () => {
    it("deletes the step", async () => {
      const plan = await prismaClient.plan.create({
        data: {
          goal: mockPlanGoal,
        },
      });
      const step = await createStep(prismaClient, {
        planId: plan.id,
        title: "Add cryptocurrency ETF",
        description: "Consider BITO for crypto exposure — later removed from plan",
        sortOrder: 1,
      });

      await removeStep(prismaClient, step.id);

      const found = await prismaClient.step.findUnique({
        where: {
          id: step.id,
        },
      });
      expect(found).toBeNull();
    });
  });

  describe("cascade delete", () => {
    it("deletes steps when the parent plan is deleted", async () => {
      const plan = await prismaClient.plan.create({
        data: {
          goal: "Abandoned sector-rotation strategy",
        },
      });
      await createStep(prismaClient, {
        planId: plan.id,
        title: "Buy energy sector ETF",
        description: "Allocate 20% to XLE for energy exposure",
        sortOrder: 1,
      });
      await createStep(prismaClient, {
        planId: plan.id,
        title: "Buy tech sector ETF",
        description: "Allocate 30% to VGT for technology exposure",
        sortOrder: 2,
      });

      await prismaClient.plan.delete({
        where: {
          id: plan.id,
        },
      });

      const steps = await prismaClient.step.findMany({
        where: {
          planId: plan.id,
        },
      });
      expect(steps).toHaveLength(0);
    });
  });
});
