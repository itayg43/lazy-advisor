import { describe, expect, it } from "vitest";

import { UserProfileSchema } from "#server/schemas/pipeline.schema";
import type { SendToUser, WaitForResponse } from "../../tools/ask-user.tool";
import { runClarifyStage } from "./clarify.stage";

type ScriptedResponder = {
  sendToUser: SendToUser;
  waitForResponse: WaitForResponse;
  getQuestionsAsked: () => string[];
};

describe("clarifyStage evals", () => {
  // Creates a deterministic user simulator from a queue of scripted responses.
  // Each response is self-contained — it dumps ALL persona info regardless of
  // what the LLM asked, making evals immune to question ordering changes.
  const createScriptedResponder = (responses: string[]): ScriptedResponder => {
    const questionsAsked: string[] = [];
    let responseIndex = 0;

    return {
      sendToUser: (message: string) => {
        questionsAsked.push(message);
      },
      waitForResponse: () => {
        const response = responses[responseIndex] ?? "that's all I have";
        responseIndex++;
        return Promise.resolve(response);
      },
      getQuestionsAsked: () => questionsAsked,
    };
  };

  // Level 1 assertion: the output must be a valid UserProfile per the Zod schema.
  // Takes unknown to validate independently of TypeScript's compile-time typing —
  // the LLM extraction could return malformed data despite the return type.
  const assertValidProfile = (profile: unknown): void => {
    const result = UserProfileSchema.safeParse(profile);
    expect(result.success).toBe(true);
  };

  // Story 1 from WORKFLOW_EXAMPLES.md — vague beginner with no details except amount.
  // Tests that the stage can gather all required fields from a single
  // self-contained user response and extract them correctly.
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

    // Outcome-based assertions only — we don't assert on how many questions
    // were asked or in what order, since the LLM may find valid paths we
    // didn't anticipate.
    assertValidProfile(profile);
    expect(profile.amount).toBe(15_000);
    expect(profile.age).toBe(28);
    expect(profile.knowledgeLevel).toBe("beginner");
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.monthlyContribution).toBe(500);
    expect(profile.location.toLowerCase()).toContain("us");
    expect(profile.timeline.toLowerCase()).toMatch(/20|50/);
  });
});
