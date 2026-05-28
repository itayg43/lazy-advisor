# Conventions

## Development Process

- Before implementing a new module, align on: (1) input types — prefer SDK/library types over custom wrappers, (2) return type shape — what the caller actually needs, (3) error strategy — which error class for which failure mode
- Check reference implementations (e.g., similar modules in this repo) before starting to code, not after the first draft

## Exports & Modules

- Named exports only (no `export default`)
- Only export what is part of a module's public API — internal types and helpers stay unexported
- Barrel `index.ts` files where defined in the plan (re-export public API)

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

## Naming

- Files: `kebab-case`, suffixed by role (e.g., `plan.service.ts`, `auth.middleware.ts`, `plan.repository.ts`, `openai.client.ts`, `clarify.stage.ts`, `ask-user.tool.ts`, `pipeline.schemas.ts`)
- Types/interfaces: `PascalCase`, suffix with purpose (e.g., `UserProfile`, `SchemaValidationError`)
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Spell out units and domain terms in constant names — no jargon abbreviations. `EXTREME_DEVIATION_PERCENTAGE_POINTS`, not `EXTREME_THRESHOLD_PP`; `MAX_NEGOTIATION_TURNS`, not `MAX_TURNS`. The name should be readable without a glossary

## File Organization

- `src/server/pipeline/data/` — static reference data that doesn't change at runtime (e.g., brokerage tables)
- Schemas in `src/server/schemas/[domain].schemas.ts`, types in `src/server/types/[domain].types.ts` — or co-located with a phase/module as `[name].schemas.ts` / `[name].types.ts`
- Phase prompt text (user-facing questions, LLM-facing classify instructions) co-located with the phase as `[phase].prompts.ts` — named-exported as constants, or as builder functions when interpolation requires runtime values. Standard pattern for `askWithClassify` phases (parameters, risk, contribution).

## Functions

- Arrow functions (`const foo = () => ...`) over `function` declarations — enforces top-to-bottom declaration order
- Module declaration order: logger → types → constants → helpers → exports
- Dependency injection via function parameters (not classes), except where the plan explicitly uses classes (e.g., `Session`)
- Async functions return typed `Promise<T>`, no bare `any`
- More than 3 domain params → group them into a typed object. Infrastructure dependencies (e.g., an API client) and identifiers stay positional — they are not counted
- Encode helper preconditions in the parameter type and narrow at the call site, not inside the helper. The caller proves the precondition with an explicit runtime check; the helper's signature reflects the narrowed type, so its body has no dead branches. Common variants (all from `openai.service.ts`):
  - Type-predicate: `if (isOpenAIError(error)) throw mapOpenAIError(error)`
  - Literal narrowing: `if (status !== "completed") throw toNotCompletedError(id, status)` — helper param: `Exclude<ResponseStatus, "completed">`
  - Success check: `if (!result.success) throw toSchemaValidationError(id, result.error)`
  - Existence check: `if (usage) logUsage(usage)` — helper param: `ResponseUsage` (not `| undefined`)
- When a helper's param is a closed union (e.g., `ClassifyError`, narrowed at the call site by an `is*` type-predicate), branch on each member and end the body with `const _exhaustive: never = value` plus a throw. Adding a new union member without a handler fails type-check there. Example: `mapClassifyError` in `ask-with-classify.errors.ts`

## Types

- Zod schemas as source of truth at stage boundaries; define in `[domain].schemas.ts`, infer types via `z.infer<typeof Schema>` and export from `[domain].types.ts` — never hand-write type duplicates
- No `any` — use `unknown` when type is uncertain
- Use `Exclude<T, U>` to remove cases from a union type and `Extract<T, U>` to keep specific cases — both for parameter types (encoding preconditions) and for domain-type definitions (e.g., discriminated arm shapes like `status: Extract<PipelineStatus, "completed">`). The source union stays the single source of truth: when it grows or shrinks, derived subset types update automatically. Don't redeclare the subset as a new string-literal union
- Discriminator tags come from Zod enums, not bare string literals. For any discriminated union (a `kind`/`status`/`direction`-style tag), define the tag values as a Zod enum in `[domain].schemas.ts`, infer the type in `[domain].types.ts`, and reference the values at call sites via `Enum.enum.x` (not `"x"`). For each variant's tag, narrow with `Extract<EnumType, "literal">` so the variant shape stays derived from the enum. Example: `AllocationCounterBranchKindEnum` + `type CounterBranch = { kind: Extract<AllocationCounterBranchKind, "extreme">; direction: AllocationCounterDirection } | ...`. Same precedent as `DirectiveKind` and `PipelineStatusEnum.enum`

## Error Handling

- HTTP-based base error classes live in `src/server/errors/index.ts`:
  - `BaseError` extends `Error`, adds `status`
  - `InternalError` (500)
  - `BadGatewayError` (502)
  - `SchemaValidationError` (502, extends `BadGatewayError`, carries a `ZodError` cause)
  - `ServiceUnavailableError` (503)
- Don't introduce new HTTP-based error classes per feature — reuse the base classes above with descriptive messages. A new HTTP status should be a deliberate, cross-cutting decision, not a per-feature convenience
- Pick the error class by what the failure indicates about _cause_: upstream-temporary (5xx, connection failure, rate-limit, non-completed response) → `ServiceUnavailableError`; our-fault (4xx malformed request, unexpected post-success state, missing config) → `InternalError`. The OpenAI mapping table below is the canonical example
- For multi-class error families intended to be caught together, expose an `is*Error` type predicate (e.g., `isOpenAIError`, `isClassifyError`) so catch blocks read as a single intent
- Error helper naming and shape:
  - `to*Error` — direct builder, returns an `Error`. The caller throws explicitly (`throw toFooError(...)`). Returning rather than throwing keeps the `throw` keyword visible at the call site and lets the helper compose (e.g., be logged or returned from another function)
  - `map*Error` — dispatcher that branches between `to*Error` builders. Also returns an `Error`; caller throws
- Domain error subclasses (e.g., `ClassifyFollowUpsExhaustedError extends InternalError`) are allowed _only_ to support an `is*Error`/`map*Error` family — when the dispatcher needs to discriminate between failure modes that share an HTTP class. They must extend an existing HTTP base class and never introduce a new HTTP status. Colocate these subclasses with the family's predicate and dispatcher; if the dispatcher serves multiple consumers with different result shapes, parameterize it generically over consumer-specific bits (e.g., `mapClassifyError<TReason extends string>` over the unresolved-reason value) rather than splitting per consumer — keeps the whole family in one place
- OpenAI error mapping. Use generic constant messages at the boundary (prevent token/response leakage); log full details at `error` level.

  | Source                                     | Mapped to                                   |
  | ------------------------------------------ | ------------------------------------------- |
  | `APIError` 5xx or 429                      | `ServiceUnavailableError`                   |
  | `APIError` 4xx non-429                     | `InternalError`                             |
  | `APIConnectionError`                       | `ServiceUnavailableError`                   |
  | Non-completed response status              | `ServiceUnavailableError`                   |
  | Schema validation failure on parsed output | `SchemaValidationError` (cause: `ZodError`) |
  | Non-API error                              | rethrow unchanged                           |

  `APIConnectionError extends APIError` — the ordering pitfall is encapsulated in `mapOpenAIError`, so catch sites use the `isOpenAIError` predicate

## OpenAI

- `callOpenAI` — use for agentic loop turns: tool call responses and conversation continuation. Returns a raw `OpenAIResponse`.
- `callOpenAIParsed<T>` — use for structured extraction. Pass the Zod schema as the second argument; the schema is also passed to the SDK via `zodTextFormat`. We re-validate `output_parsed` ourselves as defense-in-depth against the third-party SDK — schema mismatch → `SchemaValidationError`. Returns `OpenAIResponse<T>`.
- Retries: `openaiClient` is configured with `maxRetries: 3` (SDK-native exponential backoff over connection errors, 408/409/429, 5xx). Service functions do not wrap calls in a custom retry — errors reaching the handlers are post-retry
- `previous_response_id` does **not** carry `instructions` forward — every chained call must re-pass `instructions` explicitly. Omitting them causes the model to run without the system prompt

## Comments

- Comment only what's non-obvious — not what the name, structure, or surrounding code already makes clear
- Every line must add distinct information; merge related thoughts rather than splitting across lines

## ESLint

The project uses `tseslint.configs.strict` (not `strictTypeChecked`) — strict on our own code without fighting third-party `any` types from SDKs like OpenAI. If a suppression is ever needed, include a `-- reason` suffix: `// eslint-disable-next-line rule-name -- why`
