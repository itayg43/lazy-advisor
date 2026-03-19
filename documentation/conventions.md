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

## Error Handling

- `BaseError` extends `Error`, adds `statusCode`
- HTTP-based error classes extend `BaseError`:
  - `InternalError` (500)
  - `ServiceUnavailableError` (503)
  - `BadRequestError` (400)
  - `UnauthorizedError` (401)
  - `TooManyRequestsError` (429)
- No class per feature — use the right HTTP error with a descriptive message
- All error classes live in `src/server/errors/index.ts`

## Testing

- Co-located test files (next to source files, not in a separate `tests/` directory)
- Tests use `describe`/`it` blocks with clear descriptions
- Mock external services (OpenAI, Tavily), real DB for repository tests

## Types

- Zod schemas as source of truth at stage boundaries, infer types with `z.infer<>`
- Domain types in `domain.types.ts` decoupled from Prisma
- No `any` — use `unknown` when type is uncertain

## Imports

- Order: Node built-ins, then external packages, then internal (blank line between groups)
