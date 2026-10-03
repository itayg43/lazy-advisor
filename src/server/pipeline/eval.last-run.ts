import { execSync } from "node:child_process";
import fs from "node:fs";

import type { TranscriptEntry } from "#pipeline/eval.transcript";

/** One eval case's result, rendered into a block by `appendLastRunEntry`. */
type LastRunEntry = {
  name: string;
  passed: boolean;
  goal?: string;
  transcript: TranscriptEntry[];
  output?: Record<string, unknown>;
  // Structurally mirrors AllocationJudgeOutput["verdicts"] in
  // clarify.allocation.judge.ts, kept loose (criterion: string) so this
  // generic renderer stays decoupled from any one phase's criterion enum.
  // Once a second phase has a judge, extract a shared JudgeVerdict type and
  // import it here instead of re-declaring the shape.
  judge?: {
    verdicts: { criterion: string; pass: boolean; reason: string }[];
  };
  error?: string;
};

/** Resets the last-run file and writes the run header (timestamp + commit). Call in `beforeAll`. */
export const initLastRun = (filePath: string): void => {
  const timestamp = new Date().toISOString();
  let commitHash = "unknown";

  try {
    commitHash = execSync("git rev-parse HEAD").toString().trim().slice(0, 7);
  } catch {
    // not in a git repo or git unavailable
  }

  fs.writeFileSync(
    filePath,
    `# Eval Last Run\nTimestamp: ${timestamp} | Commit: ${commitHash}\n`,
  );
};

/** Appends one case's block to the last-run file. Call in `afterEach`. */
export const appendLastRunEntry = (filePath: string, entry: LastRunEntry): void => {
  const { name, passed, goal, transcript, output, judge, error } = entry;

  // Each optional section appends its own markdown block to `lines` in render
  // order (header → goal → transcript → output → judge → error); the array is
  // joined and flushed once at the end. A trailing "" in a push leaves a blank
  // line between blocks.
  const status = passed ? "✓" : "✗";
  const lines: string[] = ["", "---", "", `## ${status} ${name}`, ""];

  if (goal) {
    lines.push(`**Goal:** "${goal}"`, "");
  }

  for (const turn of transcript) {
    const prefix = turn.role === "agent" ? "**Agent:**" : "**User:**";
    lines.push(`${prefix} ${turn.content}`, "");
  }

  // Structured output as one ` | `-joined line, e.g.
  // `equityPercentage: 70 | bufferPercentage: 30`. Every phase's output is a flat
  // object of primitives, so values stringify directly; a nested object would
  // render as "[object Object]" — flatten it here if one ever appears.
  if (output) {
    const fields = Object.entries(output)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" | ");
    lines.push("**Output:**", fields, "");
  }

  // Present only when a phase wired in an LLM judge (currently allocation).
  if (judge && judge.verdicts.length > 0) {
    lines.push("**Judge:**");
    for (const verdict of judge.verdicts) {
      const mark = verdict.pass ? "✓" : "✗";
      lines.push(`- ${mark} ${verdict.criterion} — ${verdict.reason}`);
    }
    lines.push("");
  }

  if (error) {
    lines.push(`Error: ${error}`, "");
  }

  fs.appendFileSync(filePath, lines.join("\n") + "\n");
};
