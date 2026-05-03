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
import { RiskTolerance, TimelineBucket } from "#schemas/pipeline.schemas";

const LAST_RUN_PATH = new URL("clarify.risk.last-run.md", import.meta.url).pathname;

const { conservative, moderate, aggressive } = RiskTolerance.enum;

describe("collectRisk", () => {
  const mockFields: FieldsPhaseOutput = {
    amount: 50_000,
    timeline: TimelineBucket.enum["10+ years"],
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

  // clarify.risk.rules.md neutrality requirements: no historical-recovery framing.
  const expectNoNeutralityViolation = (transcript: TranscriptEntry[]) => {
    const agentText = transcript
      .filter((t) => t.role === "agent")
      .map((t) => t.content.toLowerCase())
      .join(" ");
    expect(agentText).not.toContain("recovered");
    expect(agentText).not.toContain("2008");
    expect(agentText).not.toContain("2020");
    expect(agentText).not.toContain("historically");
    expect(agentText).not.toContain("bounce back");
    expect(agentText).not.toContain("markets have");
  };

  // clarify.risk.rules.md rule 1: digit 1 → conservative
  it("should map digit 1 to conservative", async () => {
    const responder = createTrackedResponder(["1"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(1);
    expect(output.riskTolerance).toBe(conservative);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(1);
    expectNoNeutralityViolation(responder.transcript);
  });

  // clarify.risk.rules.md rule 1: digit 2 → conservative
  it("should map digit 2 to conservative", async () => {
    const responder = createTrackedResponder(["2"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(2);
    expect(output.riskTolerance).toBe(conservative);
    expectNoNeutralityViolation(responder.transcript);
  });

  // clarify.risk.rules.md rule 1: digit 3 → moderate
  it("should map digit 3 to moderate", async () => {
    const responder = createTrackedResponder(["3"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(3);
    expect(output.riskTolerance).toBe(moderate);
    expectNoNeutralityViolation(responder.transcript);
  });

  // clarify.risk.rules.md rule 1: digit 4 → aggressive
  it("should map digit 4 to aggressive", async () => {
    const responder = createTrackedResponder(["4"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(4);
    expect(output.riskTolerance).toBe(aggressive);
    expectNoNeutralityViolation(responder.transcript);
  });

  // clarify.risk.rules.md rule 1: digit 5 → aggressive
  it("should map digit 5 to aggressive", async () => {
    const responder = createTrackedResponder(["5"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(5);
    expect(output.riskTolerance).toBe(aggressive);
    expectNoNeutralityViolation(responder.transcript);
  });

  // clarify.risk.rules.md rule 1: spelled-out English word → accepted
  it("should accept spelled-out 'three' as score 3 (moderate)", async () => {
    const responder = createTrackedResponder(["three"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(3);
    expect(output.riskTolerance).toBe(moderate);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(1);
    expectNoNeutralityViolation(responder.transcript);
  });

  // clarify.risk.rules.md rule 1: spelled-out English word → accepted (one)
  it("should accept spelled-out 'one' as score 1 (conservative)", async () => {
    const responder = createTrackedResponder(["one"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(1);
    expect(output.riskTolerance).toBe(conservative);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(1);
  });

  // clarify.risk.rules.md rule 1: spelled-out English word → accepted (two)
  it("should accept spelled-out 'two' as score 2 (conservative)", async () => {
    const responder = createTrackedResponder(["two"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(2);
    expect(output.riskTolerance).toBe(conservative);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(1);
  });

  // clarify.risk.rules.md rule 1: spelled-out English word → accepted (four)
  it("should accept spelled-out 'four' as score 4 (aggressive)", async () => {
    const responder = createTrackedResponder(["four"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(4);
    expect(output.riskTolerance).toBe(aggressive);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(1);
  });

  // clarify.risk.rules.md rule 1: spelled-out English word → accepted (five)
  it("should accept spelled-out 'five' as score 5 (aggressive)", async () => {
    const responder = createTrackedResponder(["five"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(5);
    expect(output.riskTolerance).toBe(aggressive);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(1);
  });

  // clarify.risk.rules.md rule 1: number embedded in surrounding text → accepted
  it("should accept a number embedded in surrounding text", async () => {
    const responder = createTrackedResponder(["I'd say 4"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(4);
    expect(output.riskTolerance).toBe(aggressive);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(1);
  });

  // clarify.risk.rules.md rule 2: clarifying question → answer + re-present → numeric answer
  it("should answer a clarifying question then return the user's score", async () => {
    const responder = createTrackedResponder([
      "What do you mean by drop temporarily?",
      "3",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(3);
    expect(output.riskTolerance).toBe(moderate);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
    expectNoNeutralityViolation(responder.transcript);
  });

  // clarify.risk.rules.md rule 3: out-of-range number → re-ask once → valid answer
  it("should re-ask when user gives a number outside 1-5 then accept the corrected answer", async () => {
    const responder = createTrackedResponder(["7", "4"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(4);
    expect(output.riskTolerance).toBe(aggressive);
    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns).toHaveLength(2);
    // re-ask must instruct the user to pick within 1–5
    expect(agentTurns[1].content.toLowerCase()).toMatch(
      /1.*(to|through|-|–).*5|between 1 and 5|from 1 to 5/,
    );
  });

  // clarify.risk.rules.md rule 3: non-numeric wording → re-ask → numeric answer
  it("should re-ask when user answers with non-numeric wording then accept the numeric answer", async () => {
    const responder = createTrackedResponder(["I'd panic and want to sell", "1"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(1);
    expect(output.riskTolerance).toBe(conservative);
    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns).toHaveLength(2);
    // re-ask must acknowledge the emotional content — not a bare scale re-presentation
    expect(agentTurns[1].content).not.toMatch(/^Before we design/);
    expectNoNeutralityViolation(responder.transcript);
  });

  // clarify.risk.rules.md rule 3: still invalid after re-ask → default conservative
  it("should default to conservative when user remains vague after one re-ask", async () => {
    const responder = createTrackedResponder([
      "I don't know, it's hard to say",
      "Honestly I still can't say",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(1);
    expect(output.riskTolerance).toBe(conservative);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });

  // clarify.risk.rules.md rule 3: decimal input → re-ask → valid answer
  it("should re-ask on a decimal input then accept the corrected answer", async () => {
    const responder = createTrackedResponder(["3.5", "3"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(3);
    expect(output.riskTolerance).toBe(moderate);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });

  // clarify.risk.rules.md rule 3: range input → re-ask with single-number acknowledgment → valid answer
  it("should re-ask on a range input then accept the corrected answer", async () => {
    const responder = createTrackedResponder(["2-3", "2"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(2);
    expect(output.riskTolerance).toBe(conservative);
    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns).toHaveLength(2);
    // re-ask must explain the scale needs a single number, not just re-present it
    expect(agentTurns[1].content.toLowerCase()).toContain("single");
  });

  // clarify.risk.rules.md budget: with budget=3, clarifying Q + range gets a valid third turn
  it("should accept a valid answer after clarifying question followed by a range input", async () => {
    const responder = createTrackedResponder([
      "What does drop temporarily mean?",
      "2-3",
      "2",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(2);
    expect(output.riskTolerance).toBe(conservative);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(3);
  });

  // clarify.risk.rules.md rule 3 + tool-call budget: clarifying Q + two invalid answers exhaust budget → default conservative
  it("should default to conservative when a clarifying question exhausts the budget before a valid answer", async () => {
    const responder = createTrackedResponder([
      "What does drop temporarily mean?",
      "I still can't decide",
      "Honestly I still can't say",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    // budget = 3: initial ask (T1) + re-present after clarifying Q (T2) + Step 3 re-ask (T3) → still invalid → silent end
    expect(output.selfRatingScore).toBe(1);
    expect(output.riskTolerance).toBe(conservative);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(3);
  });

  // clarify.risk.rules.md rule 4: deflect age/timeline capacity questions, re-present 1–5 scale
  it("should deflect age/timeline capacity question and re-present the scale", async () => {
    const responder = createTrackedResponder([
      "Does my age or investment timeline change what score I should give?",
      "3",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(
      mockFields,
      responder.sendToUser,
      responder.waitForResponse,
    );
    lastOutput = output;

    expect(output.selfRatingScore).toBe(3);
    expect(output.riskTolerance).toBe(moderate);
    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns).toHaveLength(2);
    expect(agentTurns[1].content).toContain("1 = very uncomfortable");
    // must not use capacity factors to frame the score
    expect(agentTurns[1].content.toLowerCase()).not.toMatch(
      /can afford|with your (timeline|age)|given your (timeline|age)|more aggressive/,
    );
    expectNoNeutralityViolation(responder.transcript);
  });
});
