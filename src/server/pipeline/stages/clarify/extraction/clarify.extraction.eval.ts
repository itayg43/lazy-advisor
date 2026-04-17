import type { ResponseInputItem } from "openai/resources/responses/responses";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { toTranscriptEntries } from "#pipeline/stages/clarify/clarify.lib";
import { extractUserProfile } from "#pipeline/stages/clarify/extraction/clarify.extraction";
import { RiskTolerance, UserProfileSchema } from "#schemas/pipeline.schema";

const LAST_RUN_PATH = new URL("CLARIFY_EXTRACTION_LAST_RUN.md", import.meta.url).pathname;

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
      passed: ctx.task.result?.state === "pass",
      transcript: lastTranscript,
      output: lastProfile,
      error: ctx.task.result?.errors?.[0]?.message,
    });
    lastTranscript = lastProfile = undefined;
  });

  // CLARIFY_RULES #1: tests full clarify flow for a beginner — required fields collected, portfolio defaults
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
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.plansToContribute).toBe(true);
    expect(profile.timeline.toLowerCase()).toMatch(/20|50/);
    expect(profile.goal.toLowerCase()).toMatch(/55[,.]?000|invest/);
    expect(profile.investmentPreferences).not.toBe("none");
    expect(profile.investmentPreferences.toLowerCase()).toMatch(
      /ftse|all.world|world|global/i,
    );
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/tlv/i);
    expect(profile.investmentPreferences).toMatch(/\d+%/);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/כספית|money market/i);
  });

  // CLARIFY_FIELDS_RULES #2: tests extraction when fields are split between goal and response.
  // Portfolio defaults are asked and answered after all gaps are collected.
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
            'Good detail — just a few gaps:\n1) Do you have an emergency fund?\n2) Any debt?\n3) How much can you invest monthly going forward?\n5) What country are you in?\n6) How long is "long-term" — roughly how many years or until what age?',
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
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Before I hand this off, two things to shape the approach:\n1. What do you want your equity allocation to look like? Options include FTSE All-World (~10%/yr), MSCI World (~11%/yr), S&P 500 (~13%/yr), NASDAQ-100 (~18%/yr), TLV-125 (~8%/yr in NIS), or any combination.\n2. For the non-equity buffer, I'd suggest a קרן כספית — shekel-denominated, ~4–5% yield, capital-stable. Does that work?",
        }),
        call_id: "call_2",
        id: "fc_2",
      },
      {
        type: "function_call_output",
        call_id: "call_2",
        output: "FTSE All-World. קרן כספית for the buffer.",
      },
    ];
    lastTranscript = toTranscriptEntries(transcript);

    const profile = await extractUserProfile(transcript);
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.age).toBe(35);
    expect(profile.amount).toBe(75_000);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.plansToContribute).toBe(true);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.timeline.toLowerCase()).toMatch(/30|65|retire/);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/ftse|all.world/i);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/כספית|money market/i);
  });

  // CLARIFY_RULES #2: tests that extraction picks up the resolved risk tolerance, not the contradictory initial signals.
  // Portfolio defaults are asked and answered after contradiction is resolved.
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
            "Got it — moderate risk. A few more details I still need:\n1) How much are you investing?\n2) How old are you?\n3) What's your timeline (number of years or a milestone like retirement at age X)?\n4) Emergency fund in place? (yes/no)\n5) Any outstanding debt? (yes/no)\n6) How much can you invest monthly?\n7) What country are you in?",
        }),
        call_id: "call_2",
        id: "fc_2",
      },
      {
        type: "function_call_output",
        call_id: "call_2",
        output:
          "₪45,000, I'm 33, about 5 years, yes emergency fund, no debt, ₪1,000/mo, I'm in Israel, I'm a beginner",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Before I hand this off, two things to shape the approach:\n1. What do you want your equity allocation to look like? Options include FTSE All-World (~10%/yr), MSCI World (~11%/yr), S&P 500 (~13%/yr), NASDAQ-100 (~18%/yr), TLV-125 (~8%/yr in NIS), or any combination.\n2. For the non-equity buffer, I'd suggest a קרן כספית — shekel-denominated, ~4–5% yield, capital-stable. Does that work?",
        }),
        call_id: "call_3",
        id: "fc_3",
      },
      {
        type: "function_call_output",
        call_id: "call_3",
        output: "MSCI World. קרן כספית.",
      },
    ];
    lastTranscript = toTranscriptEntries(transcript);

    const profile = await extractUserProfile(transcript);
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(45_000);
    expect(profile.age).toBe(33);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.plansToContribute).toBe(true);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.timeline.toLowerCase()).toMatch(/5/);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/msci world/i);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/כספית|money market/i);
  });

  // CLARIFY_RULES #7: tests "moderate-to-aggressive" risk mapping and that mentioning Irish ETFs as knowledge
  // does not set investmentPreferences — portfolio defaults are still asked.
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
            "Great — a few questions to understand your situation:\n1) How old are you?\n2) What's your timeline?\n3) Risk tolerance?\n4) Emergency fund and debt status?\n5) How much can you invest monthly?\n7) What's your investing experience?\n8) What country are you in?",
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
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Since you didn't name a specific allocation, what would you like your equity split to look like? Options include FTSE All-World, MSCI World, S&P 500, NASDAQ-100, TLV-125, or any combination. For the buffer, a קרן כספית is the standard choice — does that work?",
        }),
        call_id: "call_2",
        id: "fc_2",
      },
      {
        type: "function_call_output",
        call_id: "call_2",
        output: "80% MSCI World and 20% TLV-125. קרן כספית for the buffer.",
      },
    ];
    lastTranscript = toTranscriptEntries(transcript);

    const profile = await extractUserProfile(transcript);
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(200_000);
    expect(profile.age).toBe(34);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.moderate);
    expect(profile.plansToContribute).toBe(true);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.timeline.toLowerCase()).toMatch(/20/);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/msci world/i);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/tlv/i);
    expect(profile.investmentPreferences).toMatch(/\d+%/);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/כספית|money market/i);
  });

  // CLARIFY_RULES #6: tests that 100% concentration in a single index is captured as-is without modification.
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
          "I'm 32, Israel, about 15 years, aggressive, yes emergency fund, no debt, ₪2,000/mo, intermediate",
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

  // CLARIFY_RULES #5: tests that extraction captures specific instruments with their percentage split.
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
          "I'm 31, Israel, about 15 years, moderate risk, yes emergency fund, no debt, ₪2,500/mo, intermediate.",
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
    expect(profile.plansToContribute).toBe(true);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/s&p 500|sp500/i);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/tlv/i);
    expect(profile.investmentPreferences).toMatch(/\d+%/);
  });

  // CLARIFY_RULES #9: tests that "no buffer" intent is captured correctly when user declines the buffer
  // because their emergency fund is held separately outside the portfolio.
  it("should extract no-buffer preference when user declines buffer with external emergency fund", async () => {
    const transcript: ResponseInputItem[] = [
      {
        role: "user",
        content: "I have ₪25,000 and want to invest it all in the market",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Happy to help. A few details so I can tailor the approach:\n1) How old are you?\n2) What country are you in?\n3) What's your investment timeline?\n4) Risk tolerance?\n5) Do you have an emergency fund?\n6) Any outstanding debt?\n7) How much can you add monthly?\n8) Knowledge level?\n9) Brokerage account?",
        }),
        call_id: "call_1",
        id: "fc_1",
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output:
          "I'm 26, Israel, aggressive, about 15 years, beginner, yes emergency fund, no debt, ₪500/mo",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Before I hand this off, two things:\n1. What equity allocation do you want? Options: FTSE All-World (~10%/yr), MSCI World (~11%/yr), S&P 500 (~13%/yr), NASDAQ-100 (~18%/yr), TLV-125 (~8%/yr in NIS), or any combination.\n2. For the non-equity buffer, I'd suggest a קרן כספית — shekel-denominated, ~4–5% yield, capital-stable. Does that work, or do you have a different preference?",
        }),
        call_id: "call_2",
        id: "fc_2",
      },
      {
        type: "function_call_output",
        call_id: "call_2",
        output:
          "100% S&P 500. No buffer — my emergency fund is already in a קרן כספית outside this portfolio.",
      },
    ];
    lastTranscript = toTranscriptEntries(transcript);

    const profile = await extractUserProfile(transcript);
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(25_000);
    expect(profile.age).toBe(26);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.aggressive);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/s&p 500/i);
    expect(profile.investmentPreferences.toLowerCase()).toMatch(/no buffer|separately/i);
  });

  // CLARIFY_RULES #10: passive calm holder (no discomfort, no buying-on-dips) → aggressive.
  // Absence of discomfort is the signal; buying-on-dips is not required.
  it("should extract aggressive for passive calm holder with no expressed discomfort", async () => {
    const transcript: ResponseInputItem[] = [
      {
        role: "user",
        content: "I have ₪60,000 and want to start investing long term",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Happy to help. A few details:\n1. How old are you?\n2. What's your investment timeline?\n3. If your portfolio dropped 20% in a year — would you A) sell, B) feel stressed but hold, or C) stay calm and hold (or buy more)?\n4. Do you have an emergency fund? Any debt? How much can you invest monthly? Knowledge level? Brokerage?",
        }),
        call_id: "call_1",
        id: "fc_1",
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output:
          "I'm 30, about 20 years, I'd hold and not worry about it — drops don't stress me, I'm in it for the long run. Yes emergency fund, no debt, ₪2,000/month, beginner. Israel.",
      },
      {
        type: "function_call",
        name: "ask_user",
        arguments: JSON.stringify({
          question:
            "Before I hand this off — what equity allocation do you want? Options: FTSE All-World (~10%/yr), MSCI World (~11%/yr), S&P 500 (~13%/yr), NASDAQ-100 (~18%/yr), TLV-125 (~8%/yr in NIS), or any combination. For the buffer, a קרן כספית is the standard choice — does that work?",
        }),
        call_id: "call_2",
        id: "fc_2",
      },
      {
        type: "function_call_output",
        call_id: "call_2",
        output: "80% MSCI World, 20% TLV-125. קרן כספית is fine.",
      },
    ];
    lastTranscript = toTranscriptEntries(transcript);

    const profile = await extractUserProfile(transcript);
    lastProfile = profile;

    assertValidProfile(profile);
    expect(profile.amount).toBe(60_000);
    expect(profile.age).toBe(30);
    expect(profile.riskTolerance).toBe(RiskTolerance.enum.aggressive);
    expect(profile.hasEmergencyFund).toBe(true);
    expect(profile.hasDebt).toBe(false);
    expect(profile.plansToContribute).toBe(true);
  });
});
