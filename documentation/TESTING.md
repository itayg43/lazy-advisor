# Testing

## Structure

- Co-located test files (next to source files, not in a separate `tests/` directory)
- Tests use `describe`/`it` blocks with clear descriptions
- Wrap each test file in a top-level `describe` block named after the module in camelCase (e.g., `planService`, `stepRepository`, `withRetry`); place `beforeEach` first, then `afterAll`
- Each `it` block creates its own context/options variables — no inline objects

## Mocking

- Mock external services (OpenAI), real DB for repository tests
- Use proper types for all mock data and options objects (e.g., `const options: RetryOptions = { ... }`, not untyped object literals)
- Define shared mocks as typed `const` inside the top-level `describe` block, prefixed with `mock`/`mocked` (e.g., `mockContext`, `mockedCreatePlan`). For plain function modules, use `vi.mocked()` wrappers. For object methods (e.g., `openaiClient.responses.create`), use `vi.hoisted` to declare `vi.fn()` references and inject them in the `vi.mock` factory
- Use `vi.fn()` with mock methods (`.mockResolvedValue`, `.mockRejectedValue`, etc.) for all test functions — even when a plain arrow function would work — for consistency
- Define mock factories (e.g., `createMockResponse`) inside the `describe` block that uses them, not at the top level — shared data used across all blocks (e.g., `mockUsage`, `mockParams`) stays in the top-level `describe`
- `vi.hoisted`/`vi.mock` blocks **cannot be exported** from shared files — they must stay inline in each test file. Shared mock data (e.g., `mockTokenUsage`) should also be defined inline in each test file's top-level `describe` block

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
- Extract duplicated strings within an `it` block into a `const` (e.g., `const updatedGoal = "..."`) and reference it in both params and expected result; in repository tests, assert against `params` properties (e.g., `expect(step.title).toBe(params.title)`)
- Use enum values (e.g., `PlanStatus.draft`) instead of string literals (`"draft"`) for status fields
- Use `StatusCodes` from `http-status-codes` for HTTP status values in tests (e.g., `StatusCodes.SERVICE_UNAVAILABLE`)
- Don't spy on `console.warn`/`console.log` — test logging through the real logger instead

## Repository Tests

- Repository tests run via `npm run test:repositories` (separate Vitest config with `fileParallelism: false`); excluded from `npm test` / CI
- Repository tests use a separate test database (`lazy_advisor_test`) loaded via `dotenv-cli -e .env.test`; the script resets the DB with `prisma db push --force-reset` before each run
- Repository tests define `adapter` and `prismaClient` inside the top-level `describe` block — always name it `prismaClient`, not `prisma`

## Evals

Evals test actual LLM behavior against real OpenAI — they are not unit tests and should not be mocked.

- **File convention**: `*.eval.ts` (not `*.test.ts`) — naturally excluded from `npm test` since the main Vitest config only includes `*.test.ts`
- **Run**: `npm run test:evals` (separate Vitest config: `vitest.config.evals.ts`, `fileParallelism: false`, `testTimeout: 120_000`)
- **Env**: uses `.env.test` (requires `OPENAI_API_KEY`)
- **Not in CI**: evals are slow (real API calls), non-deterministic, and cost money — run manually
- **Two eval layers** (applied per stage — see [story-to-stage mapping](workflow/WORKFLOW_EXAMPLES.md#story-to-stage-mapping) for coverage):
  - **Extraction-only**: tests extraction/parsing prompt quality in isolation by feeding deterministic input directly to the extraction function (e.g., `extractUserProfile` for clarify, `extractResearchSummary` for research). Only model extraction variance affects output. Tight assertions (exact equality for numbers/booleans/enums).
  - **Full-loop**: tests the full stage end-to-end (e.g., `runClarifyStage` with scripted responder, `runResearchStage` with real web search). Scripted responses (where applicable) are natural and focused, not info dumps. Looser assertions — schema validation is primary, exact equality only for values explicitly in the input.
- Each stage's eval file covers stories from [WORKFLOW_EXAMPLES.md](workflow/WORKFLOW_EXAMPLES.md) whose distinct behavior belongs to that stage.
- LLM-simulated users are a Level 2+ concern.
