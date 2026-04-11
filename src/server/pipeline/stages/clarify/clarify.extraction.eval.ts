import type { ResponseInputItem } from "openai/resources/responses/responses";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { extractUserProfile } from "#pipeline/stages/clarify/clarify.extraction";
import {
  KnowledgeLevel,
  RiskTolerance,
  UserProfileSchema,
} from "#schemas/pipeline.schema";

const LAST_RUN_PATH = new URL("CLARIFY_EXTRACTION_LAST_RUN.md", import.meta.url).pathname;

// Converts a ResponseInputItem[] to TranscriptEntry[] for the last-run file.
// Includes the initial user message (goal), agent questions, and user responses.
const toTranscriptEntries = (items: ResponseInputItem[]): TranscriptEntry[] =>
  items.flatMap((item): TranscriptEntry[] => {
    if ("role" in item && item.role === "user" && typeof item.content === "string") {
      return [{ role: "user", content: item.content }];
    }
    if ("type" in item && item.type === "function_call" && "name" in item && item.name === "ask_user") {
      const args = JSON.parse(item.arguments) as { question: string };
      return [{ role: "agent", content: args.question }];
    }
    if ("type" in item && item.type === "function_call_output") {
      return [{ role: "user", content: String(item.output) }];
    }
    return [];
  });

describe("clarifyExtraction", () => {
  let lastTranscript: TranscriptEntry[] | undefined;
  let lastProfile: unknown | undefined;

  const assertValidProfile = (profile: unknown): void => {
    const result = UserProfileSchema.safeParse(profile);
    expect(result.success).toBe(true);
  };

  beforeAll(() => initLastRun(LAST_RUN_PATH));

  afterEach((ctx) => {
    if (!lastTranscript) return;
    appendLastRunEntry(LAST_RUN_PATH, {
      name: ctx.task.name,
      passed: !ctx.task.result?.errors?.length,
      transcript: lastTranscript,
      profile: lastProfile,
    });
    lastTranscript = lastProfile = undefined;
  });

  // CLARIFY_EXAMPLES #1: tests full clarify flow for a beginner — required fields collected, portfolio defaults
  // question asked and answered with a custom equity split + buffer preference.
  it("should extract profile from a beginner conversation including portfolio defaults answers", async () => {
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
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Before I hand this off, two things to shape the approach:\n\n1. What do you want your equity allocation to look like?\n• FTSE All-World (~10%/yr): widest diversification, includes emerging markets.\n• MSCI World (~11%/yr): developed markets only, no EM.\n• S&P 500 (~13%/yr): US concentrated.\n• NASDAQ-100 (~18%/yr): US tech-heavy, very volatile.\n• TLV-125 (~8%/yr in NIS): Israeli market, shekel-denominated.\n\n₪55,000 over 20 years: at 10%/yr → ~₪370,000; at 13%/yr → ~₪634,000; at 18%/yr → ~₪1,200,000. Past returns don't guarantee future results.\n\nAny combination or split works — e.g., 70% FTSE All-World + 30% TLV-125.\n\n2. For the non-equity buffer, I'd suggest a קרן כספית — shekel-denominated, ~4–5% yield, capital-stable. Does that work?",
        }),
        call_id: "call_3",
        id: "fc_3",
      },
      {
        type: "function_call_output",
        call_id: "call_3",
        output: "70% FTSE All-World and 30% TLV-125. קרן כספית sounds right.",
      },
    ];
    lastTranscript = toTranscriptEntries(transcript);

    const profile = await extractUserProfile(transcript);
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(55_000);
    expect(profile.age).toBe(28);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.knowledgeLevel).toBe(KnowledgeLevel.enum.beginner);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.monthlyContribution).toBe(1_800);
    expect(profile.timeline.toLowerCase()).toMatch(/20|50/);
    expect(profile.goal.toLowerCase()).toMatch(/55[,.]?000|invest/);
    expect(profile.brokerage).toBe("none");
    expect(profile.investmentPreferences).not.toBe("none");
    expect(profile.investmentPreferences.toLowerCase()).toMatch(
      /ftse|all.world|world|global/i,
    );
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/tlv/i);
    expect(profile.investmentPreferences).toMatch(/\d+%/);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/כספית|money market/i);
  });

  // CLARIFY_EXAMPLES #10: tests extraction when fields are split between goal and response, including brokerage name (IBI).
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
    lastTranscript = toTranscriptEntries(transcript);

    const profile = await extractUserProfile(transcript);
    lastProfile = profile;

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
    expect(profile.investmentPreferences).toBe("none");
  });

  // CLARIFY_EXAMPLES #3: tests that extraction picks up the resolved risk tolerance, not the contradictory initial signals.
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
    lastTranscript = toTranscriptEntries(transcript);

    const profile = await extractUserProfile(transcript);
    lastProfile = profile;

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
    expect(profile.investmentPreferences).toBe("none");
  });

  // CLARIFY_EXAMPLES #8: tests knowledge level mapping from experience description, "moderate-to-aggressive" risk, and brokerage extraction.
  // investmentPreferences should be "none" — the user expresses knowledge about Irish ETFs, not a preference to invest in them.
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
    lastTranscript = toTranscriptEntries(transcript);

    const profile = await extractUserProfile(transcript);
    lastProfile = profile;

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
  });

  // CLARIFY_EXAMPLES #7: tests that 100% concentration in a single index is captured as-is without modification.
  it("should capture 100% single-index concentration as a valid investmentPreferences answer", async () => {
    const transcript: ResponseInputItem[] = [
      {
        role: "user",
        content: "I have ₪80,000 and I want to start investing",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Happy to help. A few questions: How old are you? What country are you in? When might you need this money? Risk tolerance? Emergency fund? Any debt? Monthly contribution? Knowledge level? Brokerage?",
        }),
        call_id: "call_1",
        id: "fc_1",
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output:
          "I'm 32, Israel, about 15 years, aggressive, yes emergency fund, no debt, ₪2,000/mo, intermediate, no brokerage",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Before I hand this off, two things:\n1. What do you want your equity allocation to look like? Options include FTSE All-World (~10%/yr), S&P 500 (~13%/yr), NASDAQ-100 (~18%/yr, very volatile), TLV-125 (~8%/yr in NIS), or any combination.\n2. For the conservative buffer, I'd suggest קרן כספית — shekel-denominated, ~4–5% yield, capital-stable. Does that work?",
        }),
        call_id: "call_2",
        id: "fc_2",
      },
      {
        type: "function_call_output",
        call_id: "call_2",
        output:
          "100% NASDAQ. I have strong conviction in tech and a long horizon — I'm fine with the volatility. קרן כספית is fine for the buffer.",
      },
    ];
    lastTranscript = toTranscriptEntries(transcript);

    const profile = await extractUserProfile(transcript);
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(80_000);
    expect(profile.age).toBe(32);
    expect(profile.investmentPreferences).not.toBe("none");
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/nasdaq/i);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/כספית|money market/i);
  });

  // CLARIFY_EXAMPLES #6: tests that extraction captures specific instruments with their percentage split.
  it("should extract investment preferences with percentage split when stated", async () => {
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
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "What percentage would you put in each — for example, 70% S&P 500 and 30% TLV-125, or 50/50?",
        }),
        call_id: "call_2",
        id: "fc_2",
      },
      {
        type: "function_call_output",
        call_id: "call_2",
        output: "70% S&P 500 and 30% TLV-125",
      },
    ];
    lastTranscript = toTranscriptEntries(transcript);

    const profile = await extractUserProfile(transcript);
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(100_000);
    expect(profile.age).toBe(31);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.knowledgeLevel).toBe(KnowledgeLevel.enum.intermediate);
    expect(profile.monthlyContribution).toBe(2_500);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.investmentPreferences).not.toBe("none");
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/s&p 500|sp500/i);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/tlv/i);
    expect(profile.investmentPreferences).toMatch(/\d+%/);
  });
});
