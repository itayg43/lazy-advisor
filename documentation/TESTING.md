# Testing

## Structure

- Co-located test files (next to source files, not in a separate `tests/` directory)
- Tests use `describe`/`it` blocks with clear descriptions — `it` block descriptions must start with `should`
- Wrap each test file in a top-level `describe` block named after the module in camelCase (e.g., `planService`, `stepRepository`, `withRetry`); place `beforeEach` first, then `afterEach`
- `beforeEach` should call `vi.clearAllMocks()` (resets `vi.fn()` call history). Add `vi.restoreAllMocks()` only when the file uses `vi.spyOn` — it reverts spies to their original implementations and is unnecessary (noise) when no spies are present. When both are needed, call them in that order
- Use `describe.each` / `it.each` to collapse multiple identical test cases that differ only by input — e.g., when the same flow runs for three goal classification types. Avoid it when the per-case setup differs significantly; flat describe blocks are clearer in that situation
- Each `it` block creates its own context/options variables — no inline objects

## What Not to Test

- **Default language behavior**: Don't test that errors propagate when there's no `try/catch` or error transformation in the code under test — that's JavaScript, not application logic.
- **Parameter variations on the same branch**: Don't add a second test for the same code path with a different numeric input (e.g. `attempts: 2` vs `attempts: 3`). Varying a value without hitting a new branch adds no safety net.
- **Mock delegation without logic**: Don't write tests that only assert a mock was called with the same arguments passed in. If a function has no conditionals, transformations, or error handling of its own, there is nothing to assert — add tests when logic is added.
- **Thin orchestration**: If a function only calls other functions in sequence with no branching or transformation, skip the unit test — it would only verify call order on mocks. Use evals to test the real behavior end-to-end.

## Mocking

- **Mock at the external boundary**: prefer testing real implementations end-to-end. When mocking is unavoidable (e.g., to avoid real API calls), mock at the outermost external boundary — the OpenAI client/service — not at internal module boundaries. Mocking internal collaborators only tests that mocks are called in order, not that the real code works.
- Mock external services (OpenAI); use a real DB for repository tests (see [Repository Tests](#repository-tests))
- Use proper types for all mock data and options objects (e.g., `const options: RetryOptions = { ... }`, not untyped object literals)
- **Mock data placement**: shared fixtures and factories (used by multiple tests) → top-level `describe`; single-use fixtures or factories → inside the specific `describe` or `it` that uses them
- Shared mocks are typed `const` prefixed with `mock`/`mocked` (e.g., `mockContext`, `mockedCreatePlan`). For plain function modules, use `vi.mocked()` wrappers. For object methods (e.g., `openaiClient.responses.create`), use `vi.hoisted` to declare `vi.fn()` references and inject them in the `vi.mock` factory
- Use `vi.fn()` with mock methods (`.mockResolvedValue`, `.mockRejectedValue`, etc.) for all test functions — even when a plain arrow function would work
- `vi.hoisted`/`vi.mock` blocks **cannot be exported** from shared files — they must stay inline in each test file
- Don't spy on `console.warn`/`console.log` — test logging through the real logger instead

### Spying on internal functions

The external-boundary rule has one exception: when the error under test originates *inside* an internal function (not at the OpenAI boundary), a global `vi.mock` would contaminate all other tests in the file. In that case, use `vi.spyOn` scoped to that specific test — `vi.restoreAllMocks()` in `beforeEach` handles cleanup automatically, so no manual `spy.mockRestore()` is needed.

In this codebase this arises when testing orchestrator branches triggered by `PhaseBudgetExhaustedError`, which is thrown by `runPhaseLoop` — not by `callOpenAI`. Mock `runPhaseLoop` via `vi.spyOn` with a rejection for the phase that should exhaust its budget. Phases that use `askWithClassify` instead of `runPhaseLoop` (e.g., risk) are unaffected by the spy — mock those at the OpenAI boundary as normal.

```ts
import * as clarifyPhase from "#pipeline/stages/clarify/shared/clarify.phase";

it("should handle allocation budget exhaustion", async () => {
  // ... callOpenAIParsed setup for classify / ef-debt / parameters / risk ...

  const runPhaseLoopSpy = vi
    .spyOn(clarifyPhase, "runPhaseLoop")
    .mockRejectedValueOnce(
      new PhaseBudgetExhaustedError("Allocation phase", MAX_ALLOCATION_TOOL_CALLS),
    );

  const result = await runClarifyStage(...);

  // assertions ...
});
```

### Import ordering with `vi.hoisted`/`vi.mock`

All `import` statements must come **before** the `vi.hoisted` + `vi.mock` block. Vitest hoists the mock declaration but does not hoist surrounding imports — placing imports after `vi.mock` causes `SyntaxError: Cannot export hoisted variable` or undefined references.

```ts
// correct — imports first, then hoisted/mock
import { describe, it, vi } from "vitest";

const { mockedFn } = vi.hoisted(() => ({ mockedFn: vi.fn() }));
vi.mock("#services/openai", () => ({ callOpenAI: mockedFn }));

// wrong — imports after vi.mock
const { mockedFn } = vi.hoisted(() => ({ mockedFn: vi.fn() }));
vi.mock("#services/openai", () => ({ callOpenAI: mockedFn }));
import { something } from "#some-module"; // breaks
```

## Test Data

- Use real domain types (e.g., `UserProfile`) in tests, not local mock type aliases
- Reference shared mock properties (e.g., `mockPlan.id`, `mockStep.id`) instead of hardcoding values like `1` or `"Learn TypeScript"`
- Use realistic domain data in mocks (e.g., ETF goals and step descriptions), not generic placeholders like `"Test plan"` or `"Description"`
- Use enum values (e.g., `PlanStatus.draft`) instead of string literals (`"draft"`) for status fields
- Use `StatusCodes` from `http-status-codes` for HTTP status values in tests (e.g., `StatusCodes.SERVICE_UNAVAILABLE`)

## Repository Tests

- Repository tests run via `npm run test:repositories` (separate Vitest config with `fileParallelism: false`); excluded from `npm test` / CI
- Repository tests use a separate test database (`lazy_advisor_test`) loaded via `dotenvx run -f .env.test`; the script resets the DB with `prisma db push --force-reset` before each run
- Repository tests define `adapter` and `prismaClient` inside the top-level `describe` block — always name it `prismaClient`, not `prisma`

## Evals

Evals test actual LLM behavior against real OpenAI — they are not unit tests and should not be mocked.

- **File convention**: `*.eval.ts` (not `*.test.ts`) — naturally excluded from `npm test` since the main Vitest config only includes `*.test.ts`
- **Run**: `npm run test:evals` (separate Vitest config: `vitest.config.evals.ts`, `fileParallelism: false`, `testTimeout: 120_000`)
- **Run a single file**: `npm run test:evals -- <file>`
- **Run specific cases**: `npm run test:evals -- <file> -t "<pattern>"` — `-t` matches against `it()` descriptions as a substring/regex
- **Env**: uses `.env.test` (requires `OPENAI_API_KEY`)
- **Not in CI**: evals are slow (real API calls), non-deterministic, and cost money — run manually
- **After each eval run**: check the co-located `*.last-run.md` file for LLM output quality — verify responses are sensible, not just that assertions passed.
- **On eval failure**: `*.last-run.md` is the first place to look — it contains the raw LLM output for every case. Use it to determine whether the fix belongs in the prompt, the eval assertion, or the rules, then re-run to validate.
- **`*.last-run.md`** — auto-generated by `initLastRun`/`appendLastRunEntry` in `eval.transcript.ts`; reset at the start of each run. Contains timestamp, commit hash, and per-case: pass/fail, goal, full agent↔user transcript, extracted output, and error (if any).
- **`*.runs.jsonl`** — auto-generated by `EvalRunReporter` in `eval.reporter.ts`; one JSON record appended per case per run, never reset. Fields: `timestamp`, `runId` (shared across a run), `commitHash`, `testName`, `passed`, `durationMs`, `error`. Accumulates across runs for trend analysis.
- **Eval granularity**: stages with multiple phases have one `.eval.ts` file per phase, co-located with the phase. Stages with a single prompt have one eval file. All run via `npm run test:evals`.
- **Unit tests vs evals**: unit tests are only written where there is branching or transformation logic; thin orchestration layers rely on evals for end-to-end verification.
- **Assertion strength**: tight (exact equality) for values explicitly present in the input. Loose (schema validation, regex) for values the model derives or summarizes. Exception: when stage rules instruct the model to return specific terminal phrases (e.g., `"Got it."` for acceptance signals), use regex matching on those markers — exact equality on the full message is too brittle.
- **Scenarios**: come from the `*.rules.md` file co-located with the phase. One test case per rule.
- **Rule reference in comments**: each eval case is prefixed with a comment pointing at the rule it covers, in the form `// clarify.<phase>.rules.md rule N: <one-line summary>`. Use the filename form (not a macro like `CLARIFY_FIELDS_RULES #N`) so the reference is greppable to the actual file. When a test exercises multiple rules, cite all (`rule 4 + rule 6: ...`).
- **Test case order mirrors rule order** for phase evals whose rules live in a single co-located file (parameters, contribution, risk): tests are ordered by ascending rule number, with multiple tests for the same rule grouped together. When adding a new rule, insert its test at the matching position — do not append. Each intake handler (classify, out-of-scope, unrealistic, contradictory) lives in its own `intake/<handler>/` subfolder with its eval co-located.
- **Multiple trials per eval deferred** — run history (`.runs.jsonl`) is the prerequisite. Add multi-trial averaging only if the logs show consistent instability on a stable codebase.
