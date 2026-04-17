import type { ResponseInputItem } from "openai/resources/responses/responses";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { toTranscriptEntries } from "#pipeline/stages/clarify/clarify.lib";
import { extractUserProfile } from "#pipeline/stages/clarify/extraction/clarify.extraction";
import { collectPreferences } from "#pipeline/stages/clarify/preferences/clarify.preferences";
import { UserProfileSchema } from "#schemas/pipeline.schema";

const LAST_RUN_PATH = new URL("CLARIFY_PREFERENCES_LAST_RUN.md", import.meta.url)
  .pathname;

describe("collectPreferences", () => {
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

  // CLARIFY_RULES #1: when no preference has been stated after field collection, the portfolio defaults
  // question is presented — equity allocation options with compound projections and a קרן כספית buffer
  // suggestion. User picks a custom equity split and accepts the buffer.
  it("should present portfolio defaults and capture equity split and buffer", async () => {
    const fieldsTranscript: ResponseInputItem[] = [
      {
        role: "user",
        content:
          "I have ₪55,000 and I want to start investing but I have no idea where to begin",
      },
      {
        type: "function_call",
        name: "ask_user",
        call_id: "call_1",
        id: "fc_1",
        arguments: JSON.stringify({
          question:
            "A few details so I can tailor this for you: How old are you? What country are you in? How many years is your investment horizon, or until what milestone? How would you describe your risk comfort — conservative, moderate, or aggressive? Do you have an emergency fund? Any outstanding debt? How much can you invest monthly? What is your knowledge level about investing?",
        }),
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output:
          "I'm 28, Israel, yes emergency fund, no debt, about 20 years, a 20% drop would stress me but I wouldn't sell, ₪1,800/mo, I'm a complete beginner",
      },
    ];

    const responder = createTrackedResponder([
      "70% FTSE All-World and 30% TLV-125. קרן כספית sounds right for the buffer.",
    ]);
    try {
      const prefsResponseId = await collectPreferences(
        fieldsTranscript,
        responder.sendToUser,
        responder.waitForResponse,
      );
      const profile = await extractUserProfile(prefsResponseId);
      lastProfile = profile;

      assertValidProfile(profile);
      expect(profile.investmentPreferences.toLowerCase()).toMatch(
        /ftse|all.world|world|global/i,
      );
      expect(profile.investmentPreferences.toLowerCase()).toMatch(/tlv/i);
      expect(profile.investmentPreferences).toMatch(/\d+%/);
      expect(profile.investmentPreferences.toLowerCase()).toMatch(/כספית|money market/i);
    } finally {
      lastTranscript = [
        ...toTranscriptEntries(fieldsTranscript),
        ...responder.transcript,
      ];
    }
  });

  // CLARIFY_RULES #4: when an equity preference is already stated in the goal, the equity guard fires
  // and the portfolio defaults question covers buffer only. User accepts קרן כספית.
  it("should skip equity defaults when preference already stated and ask buffer only", async () => {
    const fieldsTranscript: ResponseInputItem[] = [
      {
        role: "user",
        content: "I have ₪100,000 and I want to invest in tech sector ETFs",
      },
      {
        type: "function_call",
        name: "ask_user",
        call_id: "call_1",
        id: "fc_1",
        arguments: JSON.stringify({
          question:
            "A few more details: How old are you? What country are you in? What is your investment timeline? Risk tolerance? Emergency fund? Any debt? Monthly contribution? Knowledge level? Brokerage?",
        }),
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output:
          "I'm 31, Israel, moderate risk, about 15 years, intermediate, yes emergency fund, no debt, ₪2,500/mo",
      },
    ];

    const responder = createTrackedResponder(["Yes, קרן כספית is fine for the buffer."]);
    try {
      const prefsResponseId = await collectPreferences(
        fieldsTranscript,
        responder.sendToUser,
        responder.waitForResponse,
      );
      const profile = await extractUserProfile(prefsResponseId);
      lastProfile = profile;

      assertValidProfile(profile);
      expect(profile.investmentPreferences.toLowerCase()).toMatch(/tech/i);
      expect(profile.investmentPreferences.toLowerCase()).toMatch(/כספית|money market/i);
    } finally {
      lastTranscript = [
        ...toTranscriptEntries(fieldsTranscript),
        ...responder.transcript,
      ];
    }
  });

  // CLARIFY_RULES #5: when multiple instruments are named without a percentage split, the preferences
  // phase asks for the split before treating investmentPreferences as complete.
  it("should ask for split when multiple instruments are named without one", async () => {
    const fieldsTranscript: ResponseInputItem[] = [
      {
        role: "user",
        content: "I have ₪100,000 and I want to invest mainly in S&P 500 and TLV-125",
      },
      {
        type: "function_call",
        name: "ask_user",
        call_id: "call_1",
        id: "fc_1",
        arguments: JSON.stringify({
          question:
            "A few more details: How old are you? What country are you in? Investment timeline? Risk tolerance? Emergency fund? Any debt? Monthly contribution? Knowledge level? Brokerage?",
        }),
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output:
          "I'm 31, Israel, moderate risk, about 15 years, intermediate, yes emergency fund, no debt, ₪2,500/mo",
      },
    ];

    const responder = createTrackedResponder([
      "70% S&P 500 and 30% TLV-125.",
      "קרן כספית is fine for the buffer.",
    ]);
    try {
      const prefsResponseId = await collectPreferences(
        fieldsTranscript,
        responder.sendToUser,
        responder.waitForResponse,
      );
      const profile = await extractUserProfile(prefsResponseId);
      lastProfile = profile;

      assertValidProfile(profile);
      expect(profile.investmentPreferences.toLowerCase()).toMatch(/s&p 500|sp500/i);
      expect(profile.investmentPreferences.toLowerCase()).toMatch(/tlv/i);
      expect(profile.investmentPreferences).toMatch(/\d+%/);
      expect(profile.investmentPreferences.toLowerCase()).toMatch(/כספית|money market/i);
    } finally {
      lastTranscript = [
        ...toTranscriptEntries(fieldsTranscript),
        ...responder.transcript,
      ];
    }
  });

  // CLARIFY_RULES #9: when the user explicitly declines the buffer because their emergency fund is
  // held separately outside the portfolio, the stage accepts that without pushback and captures the
  // no-buffer intent in investmentPreferences.
  it("should accept no-buffer preference when emergency fund is external", async () => {
    const fieldsTranscript: ResponseInputItem[] = [
      {
        role: "user",
        content: "I have ₪25,000 and want to invest it all in the market",
      },
      {
        type: "function_call",
        name: "ask_user",
        call_id: "call_1",
        id: "fc_1",
        arguments: JSON.stringify({
          question:
            "A few details: How old are you? What country are you in? Investment timeline? Risk tolerance? Emergency fund? Any debt? Monthly contribution? Knowledge level? Brokerage?",
        }),
      },
      {
        type: "function_call_output",
        call_id: "call_1",
        output:
          "I'm 26, Israel, aggressive, about 15 years, beginner, yes emergency fund, no debt, ₪500/mo",
      },
    ];

    const responder = createTrackedResponder([
      "100% S&P 500. No buffer — my emergency fund is already in a קרן כספית outside this portfolio.",
    ]);
    try {
      const prefsResponseId = await collectPreferences(
        fieldsTranscript,
        responder.sendToUser,
        responder.waitForResponse,
      );
      const profile = await extractUserProfile(prefsResponseId);
      lastProfile = profile;

      assertValidProfile(profile);
      expect(profile.investmentPreferences.toLowerCase()).toMatch(/s&p 500/i);
      expect(profile.investmentPreferences.toLowerCase()).toMatch(
        /no buffer|separately/i,
      );
    } finally {
      lastTranscript = [
        ...toTranscriptEntries(fieldsTranscript),
        ...responder.transcript,
      ];
    }
  });
});
