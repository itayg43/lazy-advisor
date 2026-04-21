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

  // clarify.risk.rules.md rule 1: user picks A on Turn 1 → conservative
  it("should return conservative when user chooses to sell on Turn 1", async () => {
    const responder = createTrackedResponder(["A — I'd sell and move to cash"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(conservative);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(1);
  });

  // clarify.risk.rules.md rule 2: user picks B on Turn 1, then A on Turn 2 → moderate
  it("should return moderate when user stays at 20% but sells at 35%", async () => {
    const responder = createTrackedResponder([
      "B — I'd stay invested",
      "A — that's too much, I'd sell at that point",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(moderate);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });

  // clarify.risk.rules.md rule 3: user picks B on Turn 1, then B on Turn 2 → aggressive
  it("should return aggressive when user stays invested through both turns", async () => {
    const responder = createTrackedResponder([
      "B — I'd stay invested",
      "B — still stay, I trust the long-term recovery",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(aggressive);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });

  // clarify.risk.rules.md rule 4 on Turn 1: uncertain on Turn 1 → educational fallback → B on Turn 1 → A on Turn 2 → moderate
  it("should proceed through both turns after educational fallback resolves uncertainty on Turn 1", async () => {
    const responder = createTrackedResponder([
      "I'm not sure honestly",
      "B — I'd stay invested",
      "A — 35% is too much for me",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(moderate);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(3);
  });

  // clarify.risk.rules.md rule 4 on Turn 2: B on Turn 1 → uncertain on Turn 2 → educational fallback → B on Turn 2 → aggressive
  it("should give educational fallback on uncertain Turn 2 answer", async () => {
    const responder = createTrackedResponder([
      "B — I'd stay invested",
      "Hmm, I don't know about a 35% drop",
      "B — I'll still stay",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(aggressive);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(3);
  });

  // clarify.risk.rules.md rule 5 on Turn 1: market-timing on Turn 1 → redirect → B on Turn 1 → B on Turn 2 → aggressive
  it("should redirect market-timing answer on Turn 1 then return aggressive after B + B", async () => {
    const responder = createTrackedResponder([
      "I'd check the news and see if it's a temporary dip",
      "Ok fair point. B — I'd stay invested",
      "B — still stay, I'd trust the recovery",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(aggressive);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(3);
  });

  // clarify.risk.rules.md rule 5 on Turn 2: B on Turn 1 → market-timing on Turn 2 → redirect → A on Turn 2 → moderate
  it("should redirect market-timing answer on Turn 2", async () => {
    const responder = createTrackedResponder([
      "B — I'd stay invested",
      "I'd look at what's happening in the economy to decide",
      "A — at 35% I'd sell",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(moderate);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(3);
  });

  // clarify.risk.rules.md rule 6: uncertain → educational fallback → still uncertain → default conservative
  it("should default to conservative when user remains uncertain after educational fallback", async () => {
    const responder = createTrackedResponder([
      "I don't know, it's hard to say",
      "Hmm, I still don't know honestly",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(conservative);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });

  // Prompt fidelity: short-timeline (<10 years) framing template selected on Turn 1.
  // Not keyed to a rule in clarify.risk.rules.md — timeline framing is educational, not behavioral.
  it("should use short-timeline framing on Turn 1 when timeline is < 10 years", async () => {
    const shortFields: FieldsPhaseOutput = { ...mockFields, timeline: "3 years" };
    const responder = createTrackedResponder(["A — I'd sell and move to cash"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockGoal,
      shortFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(conservative);
    const firstAgentMsg =
      responder.transcript.find((t) => t.role === "agent")?.content ?? "";
    // Short-timeline template uniquely references 2000 and "shorter window"
    expect(firstAgentMsg).toMatch(/2000|shorter window/);
    // Long-timeline template phrasing should not appear
    expect(firstAgentMsg).not.toMatch(/10%\/year|20\+ year/);
  });
});
