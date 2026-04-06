import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

import type { Reporter, TestCase } from "vitest/node";

type RunRecord = {
  timestamp: string;
  // Shared across all tests in a single `test:evals` invocation.
  // Groups results from one run together and enables approximate log correlation:
  // with sequential execution, all LLM calls between two runId timestamps belong to one test.
  runId: string;
  // Git commit hash at the time of the run.
  // Correlates results to a specific code state — use to identify when a regression started.
  commitHash: string;
  testName: string;
  passed: boolean;
  durationMs: number;
  error?: string;
};

export class EvalRunReporter implements Reporter {
  private readonly runId = randomUUID();
  private readonly commitHash = execSync("git rev-parse HEAD").toString().trim();

  onTestCaseResult(testCase: TestCase): void {
    const specPath = testCase.module.moduleId;
    if (!specPath.endsWith(".eval.ts")) return;

    const jsonlPath = specPath.replace(/\.eval\.ts$/, ".runs.jsonl");
    const result = testCase.result();
    const diagnostic = testCase.diagnostic();

    const record: RunRecord = {
      timestamp: new Date().toISOString(),
      runId: this.runId,
      commitHash: this.commitHash,
      testName: testCase.fullName,
      passed: result.state === "passed",
      durationMs: diagnostic?.duration ?? 0,
    };

    if (result.state === "failed" && result.errors.length > 0) {
      record.error = result.errors[0]?.message ?? "unknown error";
    }

    fs.appendFileSync(jsonlPath, JSON.stringify(record) + "\n", "utf-8");
  }
}
