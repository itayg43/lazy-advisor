import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PlanStatus } from "#server/types/domain.types";
import { createPlan, getPlanWithSteps, updatePlan } from "./plan.repository";

describe("planRepository", () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prismaClient = new PrismaClient({
    adapter,
  });

  beforeEach(async () => {
    await prismaClient.step.deleteMany();
    await prismaClient.plan.deleteMany();
  });

  afterAll(async () => {
    await prismaClient.$disconnect();
  });

  describe("createPlan", () => {
    it("creates a plan with the given goal and default draft status", async () => {
      const goal = "Build a diversified ETF portfolio for retirement";

      const plan = await createPlan(prismaClient, goal);

      expect(plan.goal).toBe(goal);
      expect(plan.status).toBe(PlanStatus.draft);
      expect(plan.id).toEqual(expect.any(Number));
      expect(plan.createdAt).toBeInstanceOf(Date);
      expect(plan.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("getPlanWithSteps", () => {
    it("returns null for a non-existent plan id", async () => {
      const result = await getPlanWithSteps(prismaClient, 999999);

      expect(result).toBeNull();
    });

    it("returns a plan with an empty steps array when no steps exist", async () => {
      const plan = await createPlan(prismaClient, "Invest in global index funds");

      const result = await getPlanWithSteps(prismaClient, plan.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(plan.id);
      expect(result?.steps).toEqual([]);
    });

    it("returns steps ordered by sortOrder ascending", async () => {
      const plan = await createPlan(prismaClient, "Start a three-fund portfolio");
      await prismaClient.step.createMany({
        data: [
          {
            planId: plan.id,
            title: "Pick an international ETF",
            description: "Consider VXUS or IXUS for broad international exposure",
            sortOrder: 3,
          },
          {
            planId: plan.id,
            title: "Choose a US total market ETF",
            description: "Compare VTI and ITOT on expense ratio and liquidity",
            sortOrder: 1,
          },
          {
            planId: plan.id,
            title: "Select a bond ETF",
            description: "Look at BND or AGG for fixed-income allocation",
            sortOrder: 2,
          },
        ],
      });

      const result = await getPlanWithSteps(prismaClient, plan.id);

      expect(result?.steps).toHaveLength(3);
      expect(result?.steps[0]?.title).toBe("Choose a US total market ETF");
      expect(result?.steps[1]?.title).toBe("Select a bond ETF");
      expect(result?.steps[2]?.title).toBe("Pick an international ETF");
    });
  });

  describe("updatePlan", () => {
    it("updates the goal", async () => {
      const plan = await createPlan(prismaClient, "Invest in tech ETFs");

      const updatedGoal = "Focus on low-cost broad market ETFs instead";
      const updated = await updatePlan(prismaClient, plan.id, {
        goal: updatedGoal,
      });

      expect(updated.goal).toBe(updatedGoal);
    });

    it("updates the status", async () => {
      const plan = await createPlan(prismaClient, "Build a retirement portfolio");

      const updated = await updatePlan(prismaClient, plan.id, {
        status: PlanStatus.active,
      });

      expect(updated.status).toBe(PlanStatus.active);
    });
  });
});
