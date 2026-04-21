import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { collectRisk } from "#pipeline/stages/clarify/risk/clarify.risk";
import type {
  FieldsPhaseOutput,
  RiskPhaseOutput,
} from "#pipeline/stages/clarify/shared/clarify.types";
import { RiskTolerance } from "#schemas/pipeline.schema";

const LAST_RUN_PATH = new URL("clarify.risk.last-run.md", import.meta.url).pathname;

const { conservative, moderate, aggressive } = RiskTolerance.enum;

describe("collectRisk", () => {
  const mockGoal = "Invest ₪50,000 for long-term growth";
  const mockFields: FieldsPhaseOutput = {
    amount: 50_000,
    age: 35,
    timeline: "20 years",
    hasEmergencyFund: true,
    hasDebt: false,
  };

  let lastTranscript: TranscriptEntry[] | undefined;
  let lastOutput: RiskPhaseOutput | undefined;

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

  // clarify.risk.rules.md rule 1: numeric 1 → conservative
  it("should map score 1 to conservative", async () => {
    const responder = createTrackedResponder(["1"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(1);
    expect(output.riskTolerance).toBe(conservative);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(1);
  });

  // clarify.risk.rules.md rule 1: numeric 2 → conservative
  it("should map score 2 to conservative", async () => {
    const responder = createTrackedResponder(["2"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(2);
    expect(output.riskTolerance).toBe(conservative);
  });

  // clarify.risk.rules.md rule 1: numeric 3 → moderate
  it("should map score 3 to moderate", async () => {
    const responder = createTrackedResponder(["3"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(3);
    expect(output.riskTolerance).toBe(moderate);
  });

  // clarify.risk.rules.md rule 1: numeric 4 → aggressive
  it("should map score 4 to aggressive", async () => {
    const responder = createTrackedResponder(["4"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(4);
    expect(output.riskTolerance).toBe(aggressive);
  });

  // clarify.risk.rules.md rule 1: numeric 5 → aggressive
  it("should map score 5 to aggressive", async () => {
    const responder = createTrackedResponder(["5"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(5);
    expect(output.riskTolerance).toBe(aggressive);
  });

  // clarify.risk.rules.md rule 2: extreme wording maps to extreme score
  it("should map 'absolutely not' wording to score 1 (conservative)", async () => {
    const responder = createTrackedResponder(["absolutely not, I'd want to sell"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(1);
    expect(output.riskTolerance).toBe(conservative);
  });

  // clarify.risk.rules.md rule 2: 'buying opportunity' → 5 (aggressive)
  it("should map 'buying opportunity' wording to score 5 (aggressive)", async () => {
    const responder = createTrackedResponder([
      "completely comfortable, I'd see it as a buying opportunity",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(5);
    expect(output.riskTolerance).toBe(aggressive);
  });

  // clarify.risk.rules.md rule 3: clarifying question → answer + re-present → numeric answer
  it("should answer a clarifying question then return the user's score", async () => {
    const responder = createTrackedResponder([
      "What do you mean by drop temporarily?",
      "3",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(3);
    expect(output.riskTolerance).toBe(moderate);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });

  // clarify.risk.rules.md rule 4: out-of-range number → re-ask once → valid answer
  it("should re-ask when user gives a number outside 1-5 then accept the corrected answer", async () => {
    const responder = createTrackedResponder(["7", "4"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(4);
    expect(output.riskTolerance).toBe(aggressive);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });

  // clarify.risk.rules.md rule 4: still vague after re-ask → default conservative
  it("should default to conservative when user remains vague after one re-ask", async () => {
    const responder = createTrackedResponder([
      "I don't know, it's hard to say",
      "Honestly I still can't say",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(1);
    expect(output.riskTolerance).toBe(conservative);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });
});
