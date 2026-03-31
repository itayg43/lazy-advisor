# Conventions

## Development Process

- Before implementing a new module, align on: (1) input types — prefer SDK/library types over custom wrappers, (2) return type shape — what the caller actually needs, (3) error strategy — which error class for which failure mode
- Check reference implementations (existing project patterns, other repos) before starting to code, not after the first draft
- Present trade-offs proactively when making design choices — don't silently pick one approach

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

- `BaseError` extends `Error`, adds `status`
- HTTP-based error classes extend `BaseError`:
  - `InternalError` (500)
  - `ServiceUnavailableError` (503)
  - `BadRequestError` (400)
  - `NotFoundError` (404)
  - `TooManyRequestsError` (429)
- No class per feature — use the right HTTP error with a descriptive message
- External service failures (API errors, non-completed responses) → `ServiceUnavailableError`; internal failures (unexpected state after a successful call) → `InternalError`
- All error classes live in `src/server/errors/index.ts`

## Testing

See [TESTING.md](TESTING.md)

## Types

- Zod schemas as source of truth at stage boundaries, infer types with `z.infer<>`
- Domain types in `domain.types.ts` re-exported from `@prisma/client`; `PlanStatus` exported as a value (not `export type`) so it can be used at runtime
- No `any` — use `unknown` when type is uncertain

## Comments

- Only when the logic is non-obvious
- Never comment things the file name, function name, or plan already explain

## ESLint

The project uses `tseslint.configs.strict` (not `strictTypeChecked`) — strict on our own code without fighting third-party `any` types from SDKs like OpenAI. If a suppression is ever needed, include a `-- reason` suffix: `// eslint-disable-next-line rule-name -- why`

## Imports

- Order: Node built-ins, then external packages, then internal (blank line between groups)
- Use `#server/*` for imports from `src/server/` (Node.js subpath imports via `package.json` `imports` field)
- Prefer subpath imports over relative paths for cross-folder imports
- No `.js` or `.ts` extensions in imports — `moduleResolution: "bundler"` resolves `.ts` files directly

```ts
// correct
import { planService } from "#server/services/plan/plan.service";

// wrong — no file extensions in imports
import { planService } from "#server/services/plan/plan.service.ts";
```
