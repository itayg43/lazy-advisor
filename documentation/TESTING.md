# Testing

## Structure

- Co-located test files (next to source files, not in a separate `tests/` directory)
- Tests use `describe`/`it` blocks with clear descriptions — `it` block descriptions must start with `should`
- Wrap each test file in a top-level `describe` block named after the module in camelCase (e.g., `planService`, `stepRepository`, `withRetry`); place `beforeEach` first, then `afterAll`
- Each `it` block creates its own context/options variables — no inline objects

## What Not to Test

- **Default language behavior**: Don't test that errors propagate when there's no `try/catch` or error transformation in the code under test — that's JavaScript, not application logic.
- **Parameter variations on the same branch**: Don't add a second test for the same code path with a different numeric input (e.g. `attempts: 2` vs `attempts: 3`). Varying a value without hitting a new branch adds no safety net.
- **Mock delegation without logic**: Don't write tests that only assert a mock was called with the same arguments passed in. If a function has no conditionals, transformations, or error handling of its own, there is nothing to assert — add tests when logic is added.
- **Thin orchestration**: If a function only calls other functions in sequence with no branching or transformation, skip the unit test — it would only verify call order on mocks. Use evals to test the real behavior end-to-end.

## Mocking

- **Mock at the lowest boundary possible**: prefer testing real implementations end-to-end. When mocking is unavoidable (e.g., to avoid real API calls), mock at the outermost external boundary — the OpenAI client/service — not at internal module boundaries. Mocking internal collaborators only tests that mocks are called in order, not that the real code works.
- Mock external services (OpenAI); use a real DB for repository tests (see [Repository Tests](#repository-tests))
- Use proper types for all mock data and options objects (e.g., `const options: RetryOptions = { ... }`, not untyped object literals)
- **Mock data placement**: shared across all `describe` blocks → top-level `describe`. Used in only one block → inside that block. Mock factories (e.g., `createMockResponse`) always go inside the block that uses them
- Shared mocks are typed `const` prefixed with `mock`/`mocked` (e.g., `mockContext`, `mockedCreatePlan`). For plain function modules, use `vi.mocked()` wrappers. For object methods (e.g., `openaiClient.responses.create`), use `vi.hoisted` to declare `vi.fn()` references and inject them in the `vi.mock` factory
- Use `vi.fn()` with mock methods (`.mockResolvedValue`, `.mockRejectedValue`, etc.) for all test functions — even when a plain arrow function would work
- `vi.hoisted`/`vi.mock` blocks **cannot be exported** from shared files — they must stay inline in each test file
- Don't spy on `console.warn`/`console.log` — test logging through the real logger instead

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
- **Env**: uses `.env.test` (requires `OPENAI_API_KEY`)
- **Not in CI**: evals are slow (real API calls), non-deterministic, and cost money — run manually
- **Eval granularity**: stages with multiple phases have one eval file per phase (e.g., `clarify.fields.eval.ts`, `clarify.risk.eval.ts`) plus a stage-level eval for the full pipeline. Stages with a single prompt have one eval file. All run via `npm run test:evals`.
- **Assertion strength**: tight (exact equality) for values explicitly present in the input. Loose (schema validation, regex) for values the model derives or summarizes.
- **Scenarios**: come from the phase-specific rules file co-located with the implementation (e.g., `clarify.fields.rules.md`) or the stage rules file in `workflow/stages/` — one test case per rule.
- **Multiple trials per eval deferred** — run history (`.runs.jsonl`) is the prerequisite. Add multi-trial averaging only if the logs show consistent instability on a stable codebase.
