# Eval Practices & Learnings

Source: ["Stop Shipping on Vibes — How to Build Real Evals for Coding Agents"](https://www.youtube.com/watch?v=VbX24V_JFQI)

## Key Best Practices (from the video)

| Practice | Description |
|----------|-------------|
| **Quantified metrics** | Shift from pass/fail snapshots to pass rates over N runs — "94% of 200 test cases passed" |
| **Real-world datasets** | Build eval cases from merged PRs, not synthetic stories only |
| **Multiple trials per task** | LLMs can swing 10–15% between runs on identical input; average across trials for a stable signal |
| **Production logs → dataset updates** | Sample live logs to continuously surface edge cases and failure modes |
| **Deep observability** | Link every LLM call and tool use back to the eval run that triggered it — critical for debugging failures |
| **Repo test suite as scorer** | Use existing tests as the pass/fail oracle; a fix is successful if failing tests now pass |
| **Test for diversity** | Cover different languages, codebase types, and conversation shapes |

## What We're Applying Now

### Eval run history (per eval file)

**What:** Append each test result to a `.runs.jsonl` file co-located with the eval file (e.g., `clarify.stage.runs.jsonl`). One JSON line per run: timestamp, runId, commitHash, test name, pass/fail, duration, error message if failed.

**Why:** A single pass/fail is not a reliable signal for non-deterministic LLM tests. Run history enables:
- Detecting flaky evals (intermittent failures with no code change)
- Catching regressions (tests that newly started failing)
- Distinguishing LLM variance from real breakage

**Implementation:** Custom Vitest reporter in `vitest.config.evals.ts` — no changes to individual eval files. See [Section 12](plan/plan-sections/PLAN_SECTION_12.md).

## What We're Deferring (and Why)

### Multiple trials per test run

**Deferred until:** Run history reveals actual flakiness.

**Why not now:** Running 3x per test adds cost and time speculatively. History tracking is the prerequisite — it will show whether flakiness is a real problem before we invest in averaging. If evals are consistently stable, trials add noise for no gain.

### Correlation ID per eval run (observability)

**Partially addressed** by `runId` and `commitHash` in the `.runs.jsonl` records (added in Task 12.1).

- `runId` (UUID) groups all test results from a single `test:evals` invocation. Combined with per-test `timestamp` and `durationMs`, it enables approximate log correlation without touching production code: with `fileParallelism: false`, all LLM calls between a test's start and end timestamps belong to that test.
- `commitHash` links every result to an exact code state, making it possible to identify which commit introduced a regression.

**Still deferred:** Threading an ID through the stage/extraction/OpenAI call chain for precise per-call correlation. That touches production code for a testing concern and is only warranted if the above proves insufficient for active debugging.
