import { execSync } from "node:child_process";
import fs from "node:fs";

import type { Responder } from "#pipeline/tools/ask-user.tool";

export type TranscriptEntry = { role: "agent" | "user"; content: string };

type TrackedResponder = Responder & {
  transcript: TranscriptEntry[];
};

// Replaces createScriptedResponder — same interface, adds tracking.
// sendToUser captures model questions; waitForResponse returns the scripted response and captures it.
export const createTrackedResponder = (responses: string[]): TrackedResponder => {
  let responseIndex = 0;
  const transcript: TranscriptEntry[] = [];

  return {
    sendToUser: (message: string) => {
      transcript.push({ role: "agent", content: message });
    },
    waitForResponse: () => {
      if (responseIndex >= responses.length) {
        throw new Error(
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

// Called in beforeAll — clears the file and writes the run header.
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

// Called in afterEach — appends one test block to the last-run file.
export const appendLastRunEntry = (
  filePath: string,
  entry: {
    name: string;
    passed: boolean;
    goal?: string;
    transcript: TranscriptEntry[];
    output?: unknown;
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

  if (entry.error) {
    lines.push(`Error: ${entry.error}`, "");
  }

  fs.appendFileSync(filePath, lines.join("\n") + "\n");
};
