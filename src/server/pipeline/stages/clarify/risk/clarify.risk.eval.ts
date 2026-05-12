import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  appendLastRunEntry,
  createTrackedResponder,
  initLastRun,
  type TranscriptEntry,
} from "#pipeline/eval.transcript";
import { collectRisk } from "#pipeline/stages/clarify/risk/clarify.risk";
import type { RiskPhaseResult } from "#pipeline/stages/clarify/risk/clarify.risk.types";
import { RiskToleranceEnum } from "#schemas/pipeline.schemas";

const LAST_RUN_PATH = new URL("clarify.risk.last-run.md", import.meta.url).pathname;

const { conservative, moderate, aggressive } = RiskToleranceEnum.enum;

describe("collectRisk", () => {
  let lastTranscript: TranscriptEntry[] | undefined;
  let lastOutput: RiskPhaseResult | undefined;

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

  // clarify.risk.rules.md "Neutrality" section: no historical-recovery framing.
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

  // clarify.risk.rules.md rule 1: digit → bucket map (one case per bucket)
  it.each([
    { input: "1", expectedScore: 1, expectedBucket: conservative },
    { input: "3", expectedScore: 3, expectedBucket: moderate },
    { input: "5", expectedScore: 5, expectedBucket: aggressive },
  ])(
    "should map digit $input to $expectedBucket",
    async ({ input, expectedScore, expectedBucket }) => {
      const responder = createTrackedResponder([input]);
      lastTranscript = responder.transcript;

      const output = await collectRisk(responder);
      lastOutput = output;
      if (output.status !== "completed") return;

      expect(output.selfRatingScore).toBe(expectedScore);
      expect(output.riskTolerance).toBe(expectedBucket);
      expectNoNeutralityViolation(responder.transcript);
    },
  );

  // clarify.risk.rules.md rule 1: spelled-out English word → accepted
  it("should accept spelled-out 'three' as score 3 (moderate)", async () => {
    const responder = createTrackedResponder(["three"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.selfRatingScore).toBe(3);
    expect(output.riskTolerance).toBe(moderate);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(1);
    expectNoNeutralityViolation(responder.transcript);
  });

  // clarify.risk.rules.md rule 1: number embedded in surrounding text → accepted
  it("should accept a number embedded in surrounding text", async () => {
    const responder = createTrackedResponder(["I'd say 4"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.selfRatingScore).toBe(4);
    expect(output.riskTolerance).toBe(aggressive);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(1);
  });

  // clarify.risk.rules.md rule 3 sub-case (a): general clarifying question → answer + re-present → numeric answer
  it("should answer a clarifying question, re-present the scale, then return the user's score", async () => {
    const responder = createTrackedResponder([
      "What do you mean by drop temporarily?",
      "3",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.selfRatingScore).toBe(3);
    expect(output.riskTolerance).toBe(moderate);
    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns).toHaveLength(2);
    expect(agentTurns[1].content).toContain("1 = very uncomfortable");
    expectNoNeutralityViolation(responder.transcript);
  });

  // clarify.risk.rules.md rule 2: out-of-range number → re-ask → valid answer
  it("should re-ask when user gives a number outside 1-5 then accept the corrected answer", async () => {
    const responder = createTrackedResponder(["7", "4"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.selfRatingScore).toBe(4);
    expect(output.riskTolerance).toBe(aggressive);
    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns).toHaveLength(2);
    // re-ask must instruct the user to pick within 1–5
    expect(agentTurns[1].content.toLowerCase()).toMatch(
      /1.*(to|through|-|–).*5|between 1 and 5|from 1 to 5/,
    );
  });

  // clarify.risk.rules.md rule 2: non-numeric wording → re-ask → numeric answer
  it("should re-ask when user answers with non-numeric wording then accept the numeric answer", async () => {
    const responder = createTrackedResponder(["I'd panic and want to sell", "1"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.selfRatingScore).toBe(1);
    expect(output.riskTolerance).toBe(conservative);
    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns).toHaveLength(2);
    // re-ask must acknowledge the emotional content — not a bare scale re-presentation
    expect(agentTurns[1].content).not.toMatch(/^Before we design/);
    expectNoNeutralityViolation(responder.transcript);
  });

  // clarify.risk.rules.md rule 2: decimal input → re-ask → valid answer
  it("should re-ask on a decimal input then accept the corrected answer", async () => {
    const responder = createTrackedResponder(["3.5", "3"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.selfRatingScore).toBe(3);
    expect(output.riskTolerance).toBe(moderate);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(2);
  });

  // clarify.risk.rules.md rule 2: range input → re-ask with single-number acknowledgment → valid answer
  it("should re-ask on a range input then accept the corrected answer", async () => {
    const responder = createTrackedResponder(["2-3", "2"]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.selfRatingScore).toBe(2);
    expect(output.riskTolerance).toBe(conservative);
    const agentTurns = responder.transcript.filter((t) => t.role === "agent");
    expect(agentTurns).toHaveLength(2);
    // re-ask must explain the scale needs a single number, not just re-present it
    expect(agentTurns[1].content.toLowerCase()).toContain("single");
  });

  // clarify.risk.rules.md rule 3 sub-case (b): capacity question → willingness-only clarification + re-present scale
  it("should deflect age/timeline capacity question and re-present the scale", async () => {
    const responder = createTrackedResponder([
      "Does my age or investment timeline change what score I should give?",
      "3",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(responder);
    lastOutput = output;
    if (output.status !== "completed") return;

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

  // clarify.risk.rules.md rule 3 sub-case (a) + rule 2 + budget: clarifying Q within budget → range → valid
  it("should accept a valid answer after clarifying question followed by a range input", async () => {
    const responder = createTrackedResponder([
      "What does drop temporarily mean?",
      "2-3",
      "2",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(responder);
    lastOutput = output;
    if (output.status !== "completed") return;

    expect(output.selfRatingScore).toBe(2);
    expect(output.riskTolerance).toBe(conservative);
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(3);
  });

  // clarify.risk.rules.md rule 3 sub-case (a) + rule 2 + budget: clarifying Q + 2 vague exhaust budget → hard-fail
  it("should hard-fail when a clarifying question exhausts the budget before a valid answer", async () => {
    const responder = createTrackedResponder([
      "What does drop temporarily mean?",
      "I still can't decide",
      "Honestly I still can't say",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(responder);
    lastOutput = output;

    expect(output.status).toBe("unresolved");
    if (output.status !== "unresolved") return;
    expect(output.reason).toBe("risk_tolerance");
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(3);
  });

  // clarify.risk.rules.md rule 2 + budget: 3 vague exhaust budget → hard-fail
  it("should hard-fail when user remains vague through the entire budget", async () => {
    const responder = createTrackedResponder([
      "I don't know, it's hard to say",
      "Honestly I still can't say",
      "I really just don't know",
    ]);
    lastTranscript = responder.transcript;

    const output = await collectRisk(responder);
    lastOutput = output;

    expect(output.status).toBe("unresolved");
    if (output.status !== "unresolved") return;
    expect(output.reason).toBe("risk_tolerance");
    expect(responder.transcript.filter((t) => t.role === "agent")).toHaveLength(3);
  });
});
