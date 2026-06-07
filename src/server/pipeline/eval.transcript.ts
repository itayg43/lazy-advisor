import { execSync } from "node:child_process";
import fs from "node:fs";

import { InternalError } from "#errors";
import type { Responder } from "#pipeline/tools/ask-user.tool";

export type TranscriptEntry = { role: "agent" | "user"; content: string };

type TrackedResponder = Responder & {
  transcript: TranscriptEntry[];
};

/**
 * A `Responder` that records the conversation into `transcript` as it runs, so a
 * finished eval can assert on the dialogue and write it to the last-run artifact.
 * `sendToUser` captures the model's message; `waitForResponse` returns the next
 * scripted response in order (throwing if the script is exhausted) and captures it.
 */
export const createTrackedResponder = (responses: string[]): TrackedResponder => {
  let responseIndex = 0;
  const transcript: TranscriptEntry[] = [];

  return {
    sendToUser: (message: string) => {
      transcript.push({ role: "agent", content: message });
    },
    waitForResponse: () => {
      if (responseIndex >= responses.length) {
        throw new InternalError(
          `createTrackedResponder: no response scripted for turn ${responseIndex + 1} (only ${responses.length} provided)`,
        );
      }
      const response = responses[responseIndex];
      responseIndex++;
      transcript.push({ role: "user", content: response });

      return Promise.resolve(response);
    },
    transcript,
  };
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
export const appendLastRunEntry = (
  filePath: string,
  entry: {
    name: string;
    passed: boolean;
    goal?: string;
    transcript: TranscriptEntry[];
    output?: unknown;
    judge?: {
      verdicts: { criterion: string; pass: boolean; reason: string }[];
    };
    error?: string;
  },
): void => {
  const status = entry.passed ? "✓" : "✗";
  const lines: string[] = ["", "---", "", `## ${status} ${entry.name}`, ""];

  if (entry.goal) {
    lines.push(`**Goal:** "${entry.goal}"`, "");
  }

  for (const turn of entry.transcript) {
    const prefix = turn.role === "agent" ? "**Agent:**" : "**User:**";
    lines.push(`${prefix} ${turn.content}`, "");
  }

  if (entry.output != null && typeof entry.output === "object") {
    const fields = Object.entries(entry.output)
      .flatMap(([k, v]) =>
        v != null && typeof v === "object" && !Array.isArray(v)
          ? Object.entries(v as Record<string, unknown>).map(
              ([nk, nv]) => `${nk}: ${String(nv)}`,
            )
          : [`${k}: ${String(v)}`],
      )
      .join(" | ");
    lines.push("**Output:**", fields, "");
  }

  if (entry.judge && entry.judge.verdicts.length > 0) {
    lines.push("**Judge:**");
    for (const verdict of entry.judge.verdicts) {
      const mark = verdict.pass ? "✓" : "✗";
      lines.push(`- ${mark} ${verdict.criterion} — ${verdict.reason}`);
    }
    lines.push("");
  }

  if (entry.error) {
    lines.push(`Error: ${entry.error}`, "");
  }

  fs.appendFileSync(filePath, lines.join("\n") + "\n");
};
