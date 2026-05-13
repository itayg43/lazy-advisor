# Conventions

## Development Process

- Before implementing a new module, align on: (1) input types — prefer SDK/library types over custom wrappers, (2) return type shape — what the caller actually needs, (3) error strategy — which error class for which failure mode
- Check reference implementations (e.g., similar modules in this repo) before starting to code, not after the first draft

## Exports & Modules

- Named exports only (no `export default`)
- Only export what is part of a module's public API — internal types and helpers stay unexported
- Barrel `index.ts` files where defined in the plan (re-export public API)

## Naming

- Files: `kebab-case`, suffixed by role (e.g., `plan.service.ts`, `auth.middleware.ts`, `plan.repository.ts`, `openai.client.ts`, `clarify.stage.ts`, `ask-user.tool.ts`, `pipeline.schemas.ts`)
- Types/interfaces: `PascalCase`, suffix with purpose (e.g., `UserProfile`, `BadRequestError`)
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

## Functions

- Arrow functions (`const foo = () => ...`) over `function` declarations — enforces top-to-bottom declaration order
- Module declaration order: logger → types → constants → helpers → exports
- Dependency injection via function parameters (not classes), except where the plan explicitly uses classes (e.g., `Session`)
- Async functions return typed `Promise<T>`, no bare `any`
- More than 3 domain params → group them into a typed object. Infrastructure dependencies (e.g., an API client) and identifiers stay positional — they are not counted

## Error Handling

- `BaseError` extends `Error`, adds `status`
- HTTP-based error classes extend `BaseError`:
  - `InternalError` (500)
  - `ServiceUnavailableError` (503)
  - `BadRequestError` (400)
  - `NotFoundError` (404)
  - `TooManyRequestsError` (429)
- No HTTP error class per feature — use the right HTTP error with a descriptive message
- External service failures (API errors, non-completed responses) → `ServiceUnavailableError`; internal failures (unexpected state after a successful call) → `InternalError`
- OpenAI-specific error mapping (generic constant messages at the boundary to prevent token/response leakage; full details logged at `error` level): `APIError` 5xx or 429 → `ServiceUnavailableError`; `APIError` 4xx non-429 → `InternalError`; `APIConnectionError` → `ServiceUnavailableError`; non-completed response status → `ServiceUnavailableError`; missing `output_parsed` after a successful call → `InternalError`. Non-API errors rethrow unchanged. `APIConnectionError extends APIError`, so catch sites must check `APIConnectionError` before `APIError`
- All error classes live in `src/server/errors/index.ts`

## File Organization

- `src/server/pipeline/data/` — static reference data that doesn't change at runtime (e.g., brokerage tables)
- `index.ts` barrel exports are required for directories defined in the plan
- Schemas in `src/server/schemas/[domain].schemas.ts`, types in `src/server/types/[domain].types.ts` — or co-located with a phase/module as `[name].schemas.ts` / `[name].types.ts`
- Phase prompt text (user-facing questions, LLM-facing classify instructions) co-located with the phase as `[phase].prompts.ts` — named-exported as constants, or as builder functions when interpolation requires runtime values. Standard pattern for `askWithClassify` phases (parameters, risk, contribution).

## Types

- Zod schemas as source of truth at stage boundaries; define in `[domain].schemas.ts`, infer types via `z.infer<typeof Schema>` and export from `[domain].types.ts` — never hand-write type duplicates
- No `any` — use `unknown` when type is uncertain

## Comments

- Comment only what's non-obvious — not what the name, structure, or surrounding code already makes clear
- Every line must add distinct information; merge related thoughts rather than splitting across lines

## ESLint

The project uses `tseslint.configs.strict` (not `strictTypeChecked`) — strict on our own code without fighting third-party `any` types from SDKs like OpenAI. If a suppression is ever needed, include a `-- reason` suffix: `// eslint-disable-next-line rule-name -- why`

## OpenAI

- `callOpenAI` — use for agentic loop turns: tool call responses and conversation continuation. Returns a raw `OpenAIResponse`.
- `callOpenAIParsed<T>` — use for structured extraction: when the response must conform to a Zod schema passed via `zodTextFormat`. Returns `OpenAIResponse<T>` with `output_parsed` populated.
- Retries: `openaiClient` is configured with `maxRetries: 3` (SDK-native exponential backoff over connection errors, 408/409/429, 5xx). Service functions do not wrap calls in a custom retry — errors reaching the handlers are post-retry
- `previous_response_id` does **not** carry `instructions` forward — every chained call must re-pass `instructions` explicitly. Omitting them causes the model to run without the system prompt

## Imports

- Order: Node built-ins, then external packages, then internal (blank line between groups)
- No `.js` or `.ts` extensions in imports — `moduleResolution: "bundler"` resolves `.ts` files directly
- All internal imports use path aliases — no relative paths (`./`, `../`) anywhere
- Each subdirectory of `src/server/` has its own alias; the canonical list lives in `package.json` `imports` (mirrored in `tsconfig.json` `paths`). For reference:
  - `#config` → `src/server/config.ts`
  - `#constants/*` → `src/server/constants/*`
  - `#errors` → `src/server/errors/`
  - `#clients/*` → `src/server/clients/*`
  - `#lib/*` → `src/server/lib/*`
  - `#pipeline/*` → `src/server/pipeline/*`
  - `#repositories/*` → `src/server/repositories/*`
  - `#schemas/*` → `src/server/schemas/*`
  - `#services/*` → `src/server/services/*`
  - `#types/*` → `src/server/types/*`
