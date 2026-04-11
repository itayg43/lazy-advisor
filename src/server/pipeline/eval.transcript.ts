import { execSync } from "node:child_process";
import fs from "node:fs";

export type TranscriptEntry = { role: "agent" | "user"; content: string };

type TrackedResponder = {
  sendToUser: (message: string) => void;
  waitForResponse: () => Promise<string>;
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
    profile?: unknown;
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

  if (entry.profile != null && typeof entry.profile === "object") {
    const fields = Object.entries(entry.profile)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(" | ");
    lines.push("**Extracted profile:**", fields, "");
  }

  if (entry.error) {
    lines.push(`Error: ${entry.error}`, "");
  }

  fs.appendFileSync(filePath, lines.join("\n") + "\n");
};
