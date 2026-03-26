import { describe, expect, it } from "vitest";

import {
  KnowledgeLevel,
  RiskTolerance,
  UserProfileSchema,
} from "#server/schemas/pipeline.schema";
import type { SendToUser, WaitForResponse } from "../../tools/ask-user.tool";
import { runClarifyStage } from "./clarify.stage";

type ScriptedResponder = {
  sendToUser: SendToUser;
  waitForResponse: WaitForResponse;
};

describe("clarifyStage evals", () => {
  // Creates a deterministic user simulator from a queue of scripted responses.
  // Each response is self-contained — it dumps ALL persona info regardless of
  // what the LLM asked, making evals immune to question ordering changes.
  const createScriptedResponder = (responses: string[]): ScriptedResponder => {
    let responseIndex = 0;

    return {
      sendToUser: () => {},
      waitForResponse: () => {
        const response = responses[responseIndex] ?? "that's all I have";
        responseIndex++;
        return Promise.resolve(response);
      },
    };
  };

  const assertValidProfile = (profile: unknown): void => {
    const result = UserProfileSchema.safeParse(profile);
    expect(result.success).toBe(true);
  };

  // Story 1 from WORKFLOW_EXAMPLES.md — vague beginner with no details except amount.
  // Tests that the stage can gather all required fields across multiple
  // self-contained user responses and extract them correctly.
  it("story 1: extracts correct profile from a vague beginner goal", async () => {
    const responder = createScriptedResponder([
      "I'm 28 years old, I have 6 months of emergency savings, no debt, this is for long-term investing, a 20% drop would stress me but I wouldn't sell, I'm in the US, and I can invest about $500 per month. I'm a complete beginner.",
      "I'd say about 20 years, maybe until I'm around 50.",
    ]);

    const profile = await runClarifyStage(
      "I have $15k and I want to start investing but I have no idea where to begin",
      responder.sendToUser,
      responder.waitForResponse,
    );
    assertValidProfile(profile);
    expect(profile.amount).toBe(15_000);
    expect(profile.age).toBe(28);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.knowledgeLevel).toBe(KnowledgeLevel.enum.beginner);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.monthlyContribution).toBe(500);
    expect(profile.location.toLowerCase()).toContain("us");
    expect(profile.timeline.toLowerCase()).toMatch(/20|50/);
    expect(profile.goal.toLowerCase()).toContain("15k");
    expect(profile.brokerage).toBe("none");
  });
});
