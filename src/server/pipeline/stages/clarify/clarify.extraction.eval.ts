import type { ResponseInputItem } from "openai/resources/responses/responses";
import { describe, expect, it } from "vitest";

import { extractUserProfile } from "#pipeline/stages/clarify/clarify.extraction";
import {
  KnowledgeLevel,
  RiskTolerance,
  UserProfileSchema,
} from "#schemas/pipeline.schema";

describe("clarifyExtraction", () => {
  const assertValidProfile = (profile: unknown): void => {
    const result = UserProfileSchema.safeParse(profile);
    expect(result.success).toBe(true);
  };

  // Story 1: tests baseline extraction across all fields, with risk mapped from behavioral description.
  it("should extract profile from a 2-turn beginner conversation", async () => {
    const transcript: ResponseInputItem[] = [
      {
        role: "user",
        content:
          "I have ₪55,000 and I want to start investing but I have no idea where to begin",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Great — you've got the amount. A few quick details so I can tailor the next step:\n1) How old are you?\n2) What country are you in?\n3) When do you want to use this money (roughly how many years, or until what age/milestone)?\n4) How would you describe your risk comfort — would you prefer lower ups/downs (conservative), a mix (moderate), or you're okay with bigger ups/downs for higher potential (aggressive)?\n5) Do you already have an emergency fund saved? (yes/no)\n6) Do you have any outstanding debt that you're paying regularly? (yes/no)\n7) How much can you add each month (in ₪)?\n8) What's your knowledge level about investing right now (beginner, intermediate, or advanced)?",
        }),
        call_id: "call_1",
        id: "fc_1",
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output:
          "I'm 28 years old, I have 6 months of emergency savings, no debt, this is for long-term investing, a 20% drop would stress me but I wouldn't sell, I'm in Israel, and I can invest about ₪1,800 per month. I'm a complete beginner.",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            'Thanks — one last missing piece: when you say "long-term," roughly how many years is your investing timeline (e.g., 5, 10, 20+), or is it "until retirement at age X"?',
        }),
        call_id: "call_2",
        id: "fc_2",
      },
      {
        type: "function_call_output",
        call_id: "call_2",
        output: "I'd say about 20 years, maybe until I'm around 50.",
      },
    ];

    const profile = await extractUserProfile(transcript);

    assertValidProfile(profile);
    expect(profile.amount).toBe(55_000);
    expect(profile.age).toBe(28);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.knowledgeLevel).toBe(KnowledgeLevel.enum.beginner);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.monthlyContribution).toBe(1_800);
    expect(profile.location.toLowerCase()).toContain("israel");
    expect(profile.timeline.toLowerCase()).toMatch(/20|50/);
    expect(profile.goal.toLowerCase()).toMatch(/55[,.]?000|invest/);
    expect(profile.brokerage).toBe("none");
    expect(profile.investmentPreferences).toBe("none");
  });

  // Story 2: tests extraction when fields are split between goal and response, including brokerage name (IBI).
  it("should extract profile with fields split between goal and response", async () => {
    const transcript: ResponseInputItem[] = [
      {
        role: "user",
        content: "I'm 35, ₪75,000, moderate risk, long-term retirement savings",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            'Good detail — just a few gaps:\n1) Do you have an emergency fund?\n2) Any debt?\n3) How much can you invest monthly going forward?\n4) Do you have a brokerage account?\n5) What country are you in?\n6) How long is "long-term" — roughly how many years or until what age?',
        }),
        call_id: "call_1",
        id: "fc_1",
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output:
          "yes emergency fund, no debt, about ₪2,000/mo, yes I have IBI, I'm in Israel, about 30 years until retirement at 65. I'm a beginner.",
      },
    ];

    const profile = await extractUserProfile(transcript);

    assertValidProfile(profile);
    expect(profile.age).toBe(35);
    expect(profile.amount).toBe(75_000);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.monthlyContribution).toBe(2_000);
    expect(profile.brokerage.toLowerCase()).toContain("ibi");
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.knowledgeLevel).toBe(KnowledgeLevel.enum.beginner);
    expect(profile.timeline.toLowerCase()).toMatch(/30|65|retire/);
    expect(profile.location.toLowerCase()).toContain("israel");
    expect(profile.investmentPreferences).toBe("none");
  });

  // Story 8: tests that extraction picks up the resolved risk tolerance, not the contradictory initial signals.
  it("should extract resolved risk tolerance from contradictory conversation", async () => {
    const transcript: ResponseInputItem[] = [
      {
        role: "user",
        content: "I want maximum returns but I can't afford to lose any money",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Those two goals pull in opposite directions — higher returns always come with higher risk of loss. To help me understand your comfort level: imagine you invest ₪40,000 and six months later it's worth ₪32,000. Would you:\nA) Sell immediately\nB) Feel sick but hold on and wait\nC) Buy more while it's cheap",
        }),
        call_id: "call_1",
        id: "fc_1",
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output:
          "If my ₪40,000 dropped to ₪32,000 I'd feel sick but hold on and wait. I guess I'm moderate.",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Got it — moderate risk. A few more details I still need:\n1) How much are you investing?\n2) How old are you?\n3) What's your timeline (number of years or a milestone like retirement at age X)?\n4) Emergency fund in place? (yes/no)\n5) Any outstanding debt? (yes/no)\n6) How much can you invest monthly?\n7) Do you have a brokerage account?\n8) What country are you in?\n9) What's your knowledge level about investing (beginner, intermediate, advanced)?",
        }),
        call_id: "call_2",
        id: "fc_2",
      },
      {
        type: "function_call_output",
        call_id: "call_2",
        output:
          "₪45,000, I'm 33, about 5 years, yes emergency fund, no debt, ₪1,000/mo, no brokerage, I'm in Israel, I'm a beginner",
      },
    ];

    const profile = await extractUserProfile(transcript);

    assertValidProfile(profile);
    expect(profile.amount).toBe(45_000);
    expect(profile.age).toBe(33);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.monthlyContribution).toBe(1_000);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.knowledgeLevel).toBe(KnowledgeLevel.enum.beginner);
    expect(profile.brokerage).toBe("none");
    expect(profile.timeline.toLowerCase()).toMatch(/5/);
    expect(profile.location.toLowerCase()).toContain("israel");
    expect(profile.investmentPreferences).toBe("none");
  });

  // Story 12: tests knowledge level mapping from experience description, "moderate-to-aggressive" risk, and brokerage extraction.
  it("should extract profile from advanced investor conversation", async () => {
    const transcript: ResponseInputItem[] = [
      {
        role: "user",
        content: "I have ₪200,000 to invest, I already know the basics",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Great — a few questions to understand your situation:\n1) How old are you?\n2) What's your timeline?\n3) Risk tolerance?\n4) Emergency fund and debt status?\n5) How much can you invest monthly?\n6) Do you have a brokerage account?\n7) What's your investing experience?\n8) What country are you in?",
        }),
        call_id: "call_1",
        id: "fc_1",
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output:
          "34, long-term 20+ years, moderate-to-aggressive, emergency fund yes, no debt, ₪5,000/mo, I have Interactive Brokers. I've been investing for a few years — I know about Irish ETFs, tax efficiency, the basics. I'm in Israel.",
      },
    ];

    const profile = await extractUserProfile(transcript);

    assertValidProfile(profile);
    expect(profile.amount).toBe(200_000);
    expect(profile.age).toBe(34);
    expect([RiskTolerance.enum.moderate, RiskTolerance.enum.aggressive]).toContain(
      profile.riskTolerance,
    );
    expect([KnowledgeLevel.enum.intermediate, KnowledgeLevel.enum.advanced]).toContain(
      profile.knowledgeLevel,
    );
    expect(profile.monthlyContribution).toBe(5_000);
    expect(profile.brokerage.toLowerCase()).toContain("interactive brokers");
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.timeline.toLowerCase()).toMatch(/20/);
    expect(profile.location.toLowerCase()).toContain("israel");
    expect(profile.investmentPreferences).not.toBe("none");
    expect(profile.investmentPreferences.toLowerCase()).toMatch(
      /irish etf|tax efficien/i,
    );
  });

  // Story 13: tests that extraction captures specific sectors/instruments mentioned in conversation.
  it("should extract investment preferences when user mentions specific instruments", async () => {
    const transcript: ResponseInputItem[] = [
      {
        role: "user",
        content:
          "I have ₪100,000 and I want to invest mainly in S&P 500 and TLV-125 index funds",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Great choices — a few more details:\n1) How old are you?\n2) What country are you in?\n3) What's your investment timeline (number of years or milestone)?\n4) Risk tolerance — conservative, moderate, or aggressive?\n5) Emergency fund in place? (yes/no)\n6) Any outstanding debt? (yes/no)\n7) How much can you invest monthly?\n8) Knowledge level (beginner, intermediate, advanced)?",
        }),
        call_id: "call_1",
        id: "fc_1",
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output:
          "I'm 31, Israel, about 15 years, moderate risk, yes emergency fund, no debt, ₪2,500/mo, intermediate. No brokerage yet.",
      },
    ];

    const profile = await extractUserProfile(transcript);

    assertValidProfile(profile);
    expect(profile.amount).toBe(100_000);
    expect(profile.age).toBe(31);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.knowledgeLevel).toBe(KnowledgeLevel.enum.intermediate);
    expect(profile.monthlyContribution).toBe(2_500);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.location.toLowerCase()).toContain("israel");
    expect(profile.investmentPreferences).not.toBe("none");
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/s&p 500|tlv/i);
  });
});
