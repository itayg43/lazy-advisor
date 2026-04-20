import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import type { RiskPhaseOutput } from "#pipeline/stages/clarify/clarify.types";
import { collectRisk } from "#pipeline/stages/clarify/risk/clarify.risk";
import { RiskTolerance } from "#schemas/pipeline.schema";

const LAST_RUN_PATH = new URL("clarify.risk.last-run.md", import.meta.url).pathname;

const { conservative, moderate, aggressive } = RiskTolerance.enum;

describe("collectRisk", () => {
  const mockAmount = 50_000;

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

  // CLARIFY_RISK_RULES #1: user picks A → conservative
  it("should return conservative when user chooses to sell", async () => {
    const responder = createTrackedResponder(["A — I'd sell and move to cash"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockAmount,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(conservative);
  });

  // CLARIFY_RISK_RULES #2: user picks B then stressed → moderate
  it("should return moderate when user stays invested but finds it stressful", async () => {
    const responder = createTrackedResponder([
      "B — I'd stay invested",
      "Yeah I'd find that really stressful to watch",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockAmount,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(moderate);
  });

  // CLARIFY_RISK_RULES #3: user picks B then calm → aggressive
  it("should return aggressive when user stays invested and stays calm", async () => {
    const responder = createTrackedResponder([
      "B — I'd stay invested",
      "I'd stay pretty calm, I know markets recover",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockAmount,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(aggressive);
  });

  // CLARIFY_RISK_RULES #4: "I don't know" → educational fallback → re-ask → conservative
  it("should give educational fallback on uncertain answer and default to conservative", async () => {
    const responder = createTrackedResponder([
      "I don't know, it's hard to say",
      "Hmm, I still don't know honestly",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockAmount,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(conservative);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });

  // CLARIFY_RISK_RULES #5: market-timing answer → redirect → picks B + calm → aggressive
  it("should redirect market-timing answer then return aggressive after B + calm", async () => {
    const responder = createTrackedResponder([
      "I'd check the news and see if it's a temporary dip",
      "Ok fair point. B — I'd stay invested",
      "I'd be pretty calm about it",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockAmount,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.riskTolerance).toBe(aggressive);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(3);
  });
});
