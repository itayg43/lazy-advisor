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
