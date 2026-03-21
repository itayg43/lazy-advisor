# Conventions

## Exports & Modules

- Named exports only (no `export default`)
- Barrel `index.ts` files where defined in the plan (re-export public API)

## Naming

- Files: `kebab-case`, suffixed by role (e.g., `plan.service.ts`, `auth.middleware.ts`, `plan.repository.ts`, `openai.client.ts`, `clarify.stage.ts`, `ask-user.tool.ts`, `pipeline.schema.ts`)
- Types/interfaces: `PascalCase`, suffix with purpose (e.g., `UserProfile`, `BadRequestError`)
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

## Functions

- Pure functions where possible
- Dependency injection via function parameters (not classes), except where the plan explicitly uses classes (e.g., `Session`)
- Async functions return typed `Promise<T>`, no bare `any`
- More than 3 domain params → group them into a typed object. Infrastructure dependencies (e.g., `prisma`) and identifiers (e.g., `planId`) stay positional — they are not counted

## Error Handling

- `BaseError` extends `Error`, adds `statusCode`
- HTTP-based error classes extend `BaseError`:
  - `InternalError` (500)
  - `ServiceUnavailableError` (503)
  - `BadRequestError` (400)
  - `UnauthorizedError` (401)
  - `NotFoundError` (404)
  - `TooManyRequestsError` (429)
- No class per feature — use the right HTTP error with a descriptive message
- All error classes live in `src/server/errors/index.ts`

## Testing

- Co-located test files (next to source files, not in a separate `tests/` directory)
- Tests use `describe`/`it` blocks with clear descriptions
- Wrap each test file in a top-level `describe` block named after the module in camelCase (e.g., `planService`, `stepRepository`, `withRetry`); place `beforeEach` first, then `afterAll`
- Mock external services (OpenAI, Tavily), real DB for repository tests
- Repository tests run via `npm run test:repositories` (separate Vitest config with `fileParallelism: false`); excluded from `npm test` / CI
- Repository tests use a separate test database (`lazy_advisor_test`) loaded via `dotenv-cli -e .env.test`; the script resets the DB with `prisma db push --force-reset` before each run
- Repository tests define `adapter` and `prismaClient` inside the top-level `describe` block — always name it `prismaClient`, not `prisma`
- Use proper types for all mock data and options objects (e.g., `const options: RetryOptions = { ... }`, not untyped object literals)
- Define shared mocks and `vi.mocked()` wrappers as typed `const` inside the top-level `describe` block, prefixed with `mock`/`mocked` (e.g., `mockContext`, `mockedCreatePlan`)
- Each `it` block creates its own context/options variables — no inline objects
- Reference shared mock properties (e.g., `mockPlan.id`, `mockStep.id`) instead of hardcoding values like `1` or `"Learn TypeScript"`
- Use realistic domain data in mocks (e.g., ETF goals and step descriptions), not generic placeholders like `"Test plan"` or `"Description"`
- Extract duplicated strings within an `it` block into a `const` (e.g., `const updatedGoal = "..."`) and reference it in both params and expected result; in repository tests, assert against `params` properties (e.g., `expect(step.title).toBe(params.title)`)
- Use enum values (e.g., `PlanStatus.draft`) instead of string literals (`"draft"`) for status fields
- Don't spy on `console.warn`/`console.log` — test logging through the real logger instead
- Use `vi.fn()` with mock methods (`.mockResolvedValue`, `.mockRejectedValue`, etc.) for all test functions — even when a plain arrow function would work — for consistency

## Types

- Zod schemas as source of truth at stage boundaries, infer types with `z.infer<>`
- Domain types in `domain.types.ts` re-exported from `@prisma/client`; `PlanStatus` exported as a value (not `export type`) so it can be used at runtime
- No `any` — use `unknown` when type is uncertain

## Comments

- Only when the logic is non-obvious
- Never comment things the file name, function name, or plan already explain

## Imports

- Order: Node built-ins, then external packages, then internal (blank line between groups)
- Use `#shared/*` for imports from `src/shared/` and `#server/*` for imports from `src/server/` (Node.js subpath imports via `package.json` `imports` field)
- Prefer subpath imports over relative paths for cross-folder imports
- No `.js` extensions in imports — `moduleResolution: "bundler"` resolves `.ts` files directly
