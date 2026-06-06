# Conventions

## Development Process

- **Pre-implementation alignment.** Before implementing a new module, align on: (1) input types — prefer SDK/library types over custom wrappers, (2) return type shape — what the caller actually needs, (3) error strategy — which error class for which failure mode
- **Read references first.** Check reference implementations (e.g., similar modules in this repo) before starting to code, not after the first draft

## Imports & Exports

- **Named exports only** (no `export default`)
- **Public surface only.** Only export what is part of a module's public API — internal types and helpers stay unexported
- **Barrel `index.ts`** files where defined in the plan (re-export public API)
- **Import order:** Node built-ins, then external packages, then internal (blank line between groups)
- **No `.js` or `.ts` extensions in imports** — `moduleResolution: "bundler"` resolves `.ts` files directly
- **Path aliases only** — no relative paths (`./`, `../`) anywhere
- **Aliases.** Each subdirectory of `src/server/` has its own alias; the canonical list lives in `package.json` `imports` (mirrored in `tsconfig.json` `paths`). For reference:
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

- **Files:** `kebab-case`, suffixed by role (e.g., `plan.service.ts`, `auth.middleware.ts`, `plan.repository.ts`, `openai.client.ts`, `clarify.stage.ts`, `ask-user.tool.ts`, `pipeline.schemas.ts`, `clarify.allocation.lib.ts`)
- **Types/interfaces:** `PascalCase`, suffix with purpose (e.g., `UserProfile`, `SchemaValidationError`)
- **Functions:** `camelCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Spell out units and domain terms — no jargon abbreviations.** The name should be readable without a glossary. Applies across constants, variables, params, schema fields, and log keys:
  - Constants: `EXTREME_DEVIATION_PERCENTAGE_POINTS`, not `EXTREME_THRESHOLD_PP`; `MAX_NEGOTIATION_TURNS`, not `MAX_TURNS`
  - Percentages: `*Percentage` (e.g., `currentEquityPercentage`, `proposedEquityPercentage`)
  - Currency amounts: `*Amount` (e.g., `equityAmount`, `bufferAmount`)
  - Basis-point gaps: `*PercentagePoints` (e.g., `equityDeviationPercentagePoints`)
  - Zod schema fields follow the same rule (`proposedEquityPercentage`, not `proposedEquity`)
  - Logger payload keys mirror the source variable name including the suffix, so grep returns the same hits in code and logs

## Comments

- **Comment only what's non-obvious** — the *why* (rationale behind a non-obvious choice) or a *gotcha* (a load-bearing constraint that isn't visible locally, e.g. ordering that's actually a correctness guard). Never restate what the name, structure, or surrounding code already makes clear
- **Every line must add distinct information** — merge related thoughts rather than splitting across lines
- **`//` for internal rationale, `/**` only for TSDoc on exported/public declarations.** Why/gotcha comments on internal code use `//` — both block comments above a non-exported declaration and notes mid-function. Reserve `/**` for doc comments attached to an *exported* function, type, or constant: the editor surfaces these on hover at every call site, so they document the contract (what it does / what it guarantees / how to call it), not internal reasoning. Never put `/**` mid-function or on an internal declaration — it only looks like a doc comment and attaches to nothing

## File Organization

- **`src/server/pipeline/data/`** — static reference data that doesn't change at runtime (e.g., brokerage tables)
- **Schemas and types** in `src/server/schemas/[domain].schemas.ts` and `src/server/types/[domain].types.ts` — or co-located with a phase/module as `[name].schemas.ts` / `[name].types.ts`
- **Phase prompts** co-located with the phase as `[phase].prompts.ts` — named-exported as constants, or as builder functions when interpolation requires runtime values. Standard pattern for `askWithClassify` phases (parameters, risk, contribution)
- **Pure helpers** co-located with a phase as `[phase].lib.ts` — math, branch selection, formatters, and pure state transitions (functional updates that take a state value and return the next, e.g. `applyBranchFraming`). Strictly side-effect-free: **no IO, no logging, no mutable or persistent state** — operating on state-*shaped* values is fine, holding or mutating state is not. Keeping `.lib` pure means it tests with no mocks. Logging and model calls live in the IO/orchestration layers, never here. Example: `clarify.allocation.lib.ts`
- **Model-IO layer** for `runConversation`-based phases, co-located as `[phase].io.ts` — the functions that call OpenAI (turn classifiers, reply composers) with the phase's prompts/schemas, plus the logging of those calls. Extracting them keeps the main `[phase].ts` file focused on turn-decision logic and runner wiring, and keeps `.lib` pure. Deterministic message builders that don't call the model (e.g. an opening proposal string) stay with their caller in the main file. Example: `clarify.allocation.io.ts`. (Older intake-style phases keep their phase IO in `.lib`; new run-conversation phases should split it into `.io`.)
- **Turn-decision logic, conversation flow, and state management** stay in the main `[phase].ts` file — it wires the `runConversation` handlers, maps turn decisions to runner outputs, and calls into `.io` and `.lib`

## Types

- **Zod as source of truth** at stage boundaries. Define in `[domain].schemas.ts`, infer types via `z.infer<typeof Schema>` and export from `[domain].types.ts` — never hand-write type duplicates
- **No `any`** — use `unknown` when type is uncertain
- **Subsets via `Exclude` / `Extract`.** Use `Exclude<T, U>` to remove cases from a union type and `Extract<T, U>` to keep specific cases — for parameter types (encoding preconditions), domain-type definitions (e.g., discriminated arm shapes like `status: Extract<PipelineStatus, "completed">`), and helper return types when a helper only produces one arm of a union contract (e.g., a turn handler that only ever returns `Ask` → `Promise<Extract<HandlerOutput<R>, { kind: typeof HandlerOutputKind.Ask }>>`; name the alias in the phase's `.types.ts` when it's referenced more than once). The source union stays the single source of truth: when it grows or shrinks, derived subset types update automatically. Don't redeclare the subset as a new string-literal union
- **Discriminator tags come from Zod enums, not bare string literals.** For any discriminated union (a `kind` / `status` / `direction`-style tag), define the tag values as a Zod enum in `[domain].schemas.ts`, infer the type in `[domain].types.ts`, and reference the values at call sites via `Enum.enum.x` (not `"x"`). For each variant's tag, narrow with `Extract<EnumType, "literal">` so the variant shape stays derived from the enum. Example: `AllocationCounterBranchKindEnum` + `type CounterBranch = { kind: Extract<AllocationCounterBranchKind, "extreme">; direction: AllocationExtremeCounterDirection } | ...`. Same precedent as `HandlerOutputKind` and `PipelineStatusEnum.enum`

## Functions

- **Arrow functions** (`const foo = () => ...`) over `function` declarations — enforces top-to-bottom declaration order
- **Module declaration order:** logger → types → constants → helpers → exports
- **Dependency injection via params,** not classes — except where the plan explicitly uses classes (e.g., `Session`)
- **Typed `Promise<T>` returns** on async functions, no bare `any`
- **More than 3 domain params → group them into a typed object.** Infrastructure dependencies (e.g., an API client) and identifiers stay positional — they are not counted
- **Adjacent same-typed params that could be transposed silently → group into a destructured object,** even when under the count threshold above. Two `number` percentages side by side (e.g. `proposedEquityPercentage` / `previousEquityPercentage`, `currentEquityPercentage` / `anchorEquityPercentage`) are the canonical case: the compiler can't catch a swap, so the object's keys name each argument at the call site. Use an inline object type when the pair is local to one function (don't promote it to a named/exported type unless it travels together through several functions, like `AllocationFramingFlags`). Params of clearly different magnitude or meaning (a shekel `amount` next to an `equityPercentage`) don't need this
- **Annotate contract role and narrowed return together when both apply.** When a function implements a named contract type (e.g., `InitHandler<R>`, `TurnHandler<R>`) but its body only produces a narrower arm of that contract's return union, annotate both at the declaration site: `const initHandler: InitHandler<R> = async (): Promise<AskDirective> => ({...})`. The contract annotation documents the function's role for the reader; the narrowed return documents the actual behavior. Omit the contract annotation only when the function is built by a factory whose return type already encodes the contract (e.g., `createTurnHandler` returns `TurnHandler<R>`)

## Helpers

- **Encode helper preconditions in the parameter type and narrow at the call site, not inside the helper.** The caller proves the precondition with an explicit runtime check; the helper's signature reflects the narrowed type, so its body has no dead branches. Common variants (all from `openai.service.ts`):
  - Type-predicate: `if (isOpenAIError(error)) throw mapOpenAIError(error)`
  - Literal narrowing: `if (status !== "completed") throw toNotCompletedError(id, status)` — helper param: `Exclude<ResponseStatus, "completed">`
  - Success check: `if (!result.success) throw toSchemaValidationError(id, result.error)`
  - Existence check: `if (usage) logUsage(usage)` — helper param: `ResponseUsage` (not `| undefined`)
- **Exhaustive branching on closed unions.** When a helper's param is a closed union (e.g., `ClassifyError`, narrowed at the call site by an `is*` type-predicate), branch on each member and end the body with `const _exhaustive: never = value` plus a throw. Adding a new union member without a handler fails type-check there. Example: `mapClassifyError` in `ask-with-classify.errors.ts`
- **Build a result from named fields instead of spreading a param that may be structurally wider.** TypeScript lets a caller pass an object wider than the parameter type, and a spread copies *runtime* properties, not the declared ones — so `return { ...flags, x: true }` silently carries extra fields when `flags` is actually a wider value (e.g. the full state passed where only its two flags are typed). Destructure the declared fields at the top of the body and construct each return from them; the result then matches its annotation at runtime regardless of the argument, so extra fields can't overwrite unrelated keys downstream (e.g. when the result is spread into a state patch). Example: `applyBranchFraming` in `clarify.allocation.lib.ts`
- **Keep formatters and helpers monomorphic until a second caller exists.** Don't add `locale` / `currency` / `format` parameters with defaults for hypothetical reuse. Name the helper for the actual behavior (`formatCurrency` with hardcoded ₪ + locale, not `formatToCurrency(n, locale)` with a default) and generalize only when a real second caller arrives — the parameter is then justified by the call site that needs it

## Text Composition

- **Multi-line text uses template literals with literal newlines** — the established pattern in `*.prompts.ts`. Do not build text by joining string arrays (`[...].join("\n")`)
- **Exception: space-joined single-line prose.** If you need multiple sentences on a single output line, the array-of-sentences + `.join(" ")` form is clearer than a template literal with backslash continuations. Prefer this only when behavior requires a single line of output

## Error Handling

- **HTTP-based base error classes** live in `src/server/errors/index.ts`:
  - `BaseError` extends `Error`, adds `status`
  - `InternalError` (500)
  - `BadGatewayError` (502)
  - `SchemaValidationError` (502, extends `BadGatewayError`, carries a `ZodError` cause)
  - `ServiceUnavailableError` (503)
- **No new HTTP-based error classes per feature** — reuse the base classes above with descriptive messages. A new HTTP status should be a deliberate, cross-cutting decision, not a per-feature convenience
- **Pick the error class by what the failure indicates about _cause_:** upstream-temporary (5xx, connection failure, rate-limit, non-completed response) → `ServiceUnavailableError`; our-fault (4xx malformed request, unexpected post-success state, missing config) → `InternalError`. The OpenAI mapping table below is the canonical example
- **`is*Error` predicates** for multi-class error families intended to be caught together (e.g., `isOpenAIError`, `isClassifyError`) so catch blocks read as a single intent
- **Error helper naming and shape:**
  - `to*Error` — direct builder, returns an `Error`. The caller throws explicitly (`throw toFooError(...)`). Returning rather than throwing keeps the `throw` keyword visible at the call site and lets the helper compose (e.g., be logged or returned from another function)
  - `map*Error` — dispatcher that branches between `to*Error` builders. Also returns an `Error`; caller throws
- **Domain error subclasses** (e.g., `ClassifyFollowUpsExhaustedError extends InternalError`) are allowed _only_ to support an `is*Error` / `map*Error` family — when the dispatcher needs to discriminate between failure modes that share an HTTP class. They must extend an existing HTTP base class and never introduce a new HTTP status. Colocate these subclasses with the family's predicate and dispatcher; if the dispatcher serves multiple consumers with different result shapes, parameterize it generically over consumer-specific bits (e.g., `mapClassifyError<TReason extends string>` over the unresolved-reason value) rather than splitting per consumer — keeps the whole family in one place
- **OpenAI error mapping.** Use generic constant messages at the boundary (prevent token/response leakage); log full details at `error` level.

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

- **`callOpenAI`** — use for agentic loop turns: tool call responses and conversation continuation. Returns a raw `OpenAIResponse`
- **`callOpenAIParsed<T>`** — use for structured extraction. Pass the Zod schema as the second argument; the schema is also passed to the SDK via `zodTextFormat`. We re-validate `output_parsed` ourselves as defense-in-depth against the third-party SDK — schema mismatch → `SchemaValidationError`. Returns `OpenAIResponse<T>`
- **Retries.** `openaiClient` is configured with `maxRetries: 3` (SDK-native exponential backoff over connection errors, 408/409/429, 5xx). Service functions do not wrap calls in a custom retry — errors reaching the handlers are post-retry
- **`previous_response_id` does not carry `instructions` forward** — every chained call must re-pass `instructions` explicitly. Omitting them causes the model to run without the system prompt

## ESLint

The project uses `tseslint.configs.strict` (not `strictTypeChecked`) — strict on our own code without fighting third-party `any` types from SDKs like OpenAI. If a suppression is ever needed, include a `-- reason` suffix: `// eslint-disable-next-line rule-name -- why`
