# Conventions

## Development Process

- Before implementing a new module, align on: (1) input types — prefer SDK/library types over custom wrappers, (2) return type shape — what the caller actually needs, (3) error strategy — which error class for which failure mode
- Check reference implementations (e.g., similar modules in this repo) before starting to code, not after the first draft

## Exports & Modules

- Named exports only (no `export default`)
- Only export what is part of a module's public API — internal types and helpers stay unexported
- Barrel `index.ts` files where defined in the plan (re-export public API)

## Naming

- Files: `kebab-case`, suffixed by role (e.g., `plan.service.ts`, `auth.middleware.ts`, `plan.repository.ts`, `openai.client.ts`, `clarify.stage.ts`, `ask-user.tool.ts`, `pipeline.schema.ts`)
- Types/interfaces: `PascalCase`, suffix with purpose (e.g., `UserProfile`, `BadRequestError`)
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

## Functions

- Arrow functions (`const foo = () => ...`) over `function` declarations — enforces top-to-bottom declaration order and is consistent with the rest of the codebase
- Module declaration order: logger (treated as import-level dependency) → types → constants → helpers → exports
- Dependency injection via function parameters (not classes), except where the plan explicitly uses classes (e.g., `Session`)
- Async functions return typed `Promise<T>`, no bare `any`
- More than 3 domain params → group them into a typed object. Infrastructure dependencies (e.g., `prisma`) and identifiers (e.g., `planId`) stay positional — they are not counted

## Error Handling

- `BaseError` extends `Error`, adds `status`
- HTTP-based error classes extend `BaseError`:
  - `InternalError` (500)
  - `ServiceUnavailableError` (503)
  - `BadRequestError` (400)
  - `NotFoundError` (404)
  - `TooManyRequestsError` (429)
- No class per feature — use the right HTTP error with a descriptive message
- External service failures (API errors, non-completed responses) → `ServiceUnavailableError`; internal failures (unexpected state after a successful call) → `InternalError`
- OpenAI-specific: `APIError` or non-completed status → `ServiceUnavailableError` with a generic constant message (prevents token/response leakage to clients), real error details logged at `error` level. Missing `output_parsed` after a successful call → `InternalError`. Non-API errors rethrow unchanged
- All error classes live in `src/server/errors/index.ts`

## File Organization

- `src/server/pipeline/lib/` — shared pure utilities used by 2+ stages (e.g., `build-profile-summary.ts`). Single-stage helpers stay in the stage directory
- `src/server/pipeline/data/` — static reference data that doesn't change at runtime (e.g., brokerage tables)
- `index.ts` barrel exports are required for directories defined in the plan
- Schemas in `src/server/schemas/[domain].schema.ts`, types in `src/server/types/[domain].types.ts`

## Types

- Zod schemas as source of truth at stage boundaries; define in `[domain].schema.ts`, infer types via `z.infer<typeof Schema>` and export from `[domain].types.ts`. Schema is the single source of truth — types are derived, never hand-written duplicates
- Domain types in `domain.types.ts` re-exported from `@prisma/client`; `PlanStatus` exported as a value (not `export type`) so it can be used at runtime
- No `any` — use `unknown` when type is uncertain

## Comments

- Comment only what's non-obvious — not what the name, structure, or surrounding code already makes clear
- Every line must add distinct information; merge related thoughts rather than splitting across lines

## ESLint

The project uses `tseslint.configs.strict` (not `strictTypeChecked`) — strict on our own code without fighting third-party `any` types from SDKs like OpenAI. If a suppression is ever needed, include a `-- reason` suffix: `// eslint-disable-next-line rule-name -- why`

## Imports

- Order: Node built-ins, then external packages, then internal (blank line between groups)
- No `.js` or `.ts` extensions in imports — `moduleResolution: "bundler"` resolves `.ts` files directly
- All internal imports use path aliases — no relative paths (`./`, `../`) anywhere
- Each subdirectory of `src/server/` has its own alias defined in `package.json` `imports` and `tsconfig.json` `paths`:
  - `#config` → `src/server/config.ts`
  - `#errors` → `src/server/errors/`
  - `#clients/*` → `src/server/clients/*`
  - `#lib/*` → `src/server/lib/*`
  - `#pipeline/*` → `src/server/pipeline/*`
  - `#repositories/*` → `src/server/repositories/*`
  - `#schemas/*` → `src/server/schemas/*`
  - `#services/*` → `src/server/services/*`
  - `#types/*` → `src/server/types/*`
