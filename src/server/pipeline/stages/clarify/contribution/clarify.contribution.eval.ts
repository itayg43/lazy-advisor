import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import type {
  ContributionPhaseOutput,
  FieldsPhaseOutput,
} from "#pipeline/stages/clarify/clarify.types";
import { collectContribution } from "#pipeline/stages/clarify/contribution/clarify.contribution";

const LAST_RUN_PATH = new URL("clarify.contribution.last-run.md", import.meta.url)
  .pathname;

describe("collectContribution", () => {
  const mockFields: FieldsPhaseOutput = {
    goal: "Invest ₪30,000 for long-term retirement savings",
    amount: 30_000,
    age: 35,
    timeline: "30 years",
    hasEmergencyFund: true,
    hasDebt: false,
  };

  let lastTranscript: TranscriptEntry[] | undefined;
  let lastOutput: ContributionPhaseOutput | undefined;

  beforeAll(() => initLastRun(LAST_RUN_PATH));

  afterEach((ctx) => {
    if (!lastTranscript) return;
    appendLastRunEntry(LAST_RUN_PATH, {
      name: ctx.task.name,
      passed: ctx.task.result?.state === "pass",
      transcript: lastTranscript,
      output: lastOutput,
      error: ctx.task.result?.errors?.[0]?.message,
    });
    lastTranscript = lastOutput = undefined;
  });

  // CLARIFY_CONTRIBUTION_RULES #1: explicit yes → plansToContribute: true
  it("should return true when user explicitly confirms periodic contributions", async () => {
    const responder = createTrackedResponder(["Yes, I plan to add ₪500 every month"]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.plansToContribute).toBe(true);
  });

  // CLARIFY_CONTRIBUTION_RULES #2: explicit no → plansToContribute: false
  it("should return false when user explicitly declines periodic contributions", async () => {
    const responder = createTrackedResponder(["No, this is a one-time investment"]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.plansToContribute).toBe(false);
  });

  // CLARIFY_CONTRIBUTION_RULES #3: vague answer → acknowledge briefly, resolve to false
  it("should return false and acknowledge when user gives a vague answer", async () => {
    const responder = createTrackedResponder(["Maybe someday, but not regularly"]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.plansToContribute).toBe(false);
  });

  // CLARIFY_CONTRIBUTION_RULES #4: user asks what DCA means → explanation → yes
  it("should explain DCA when asked and return true after user confirms", async () => {
    const responder = createTrackedResponder([
      "What does contributing periodically mean?",
      "Oh that makes sense, yes I'd like to do that",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.plansToContribute).toBe(true);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });

  // CLARIFY_CONTRIBUTION_RULES #4: user asks what DCA means → explanation → no
  it("should explain DCA when asked and return false after user declines", async () => {
    const responder = createTrackedResponder([
      "What's DCA?",
      "I see, but I think I'll just invest once for now",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.plansToContribute).toBe(false);
  });

  // CLARIFY_CONTRIBUTION_RULES #5: Israel-specific concern → address accurately → yes
  it("should address fractional share concern and return true after user confirms", async () => {
    const responder = createTrackedResponder([
      "In Israel you can't buy partial ETF units so it's hard to invest small amounts",
      "Ok, investing quarterly makes sense to me — yes I'd like to do that",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectContribution(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.plansToContribute).toBe(true);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });
});
