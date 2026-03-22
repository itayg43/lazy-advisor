## Section 3: Stage 1 — Clarify

**Goal**: Given raw goal text, calls OpenAI (Responses API) with `ask_user` tool, asks adaptive questions, produces validated UserProfile via structured output.

**Reference**: OpenAI Responses API — client singleton, `responses.parse()` with `zodTextFormat()`, status + `output_parsed` validation, token usage via `input_tokens`/`output_tokens`, `temperature: 0` for deterministic structured output.

### Design Decisions

- **Responses API over Chat Completions** — native tool calling and structured output via `responses.parse()`, less manual work than `chat.completions`. Trade-off: fewer community examples
- **Client/service split for OpenAI** — `openai.client.ts` exports the singleton, `openai.service.ts` exports `callOpenAI` / `callOpenAIParsed`. Service accepts `ResponseCreateParamsNonStreaming` directly (no custom wrapper types). Callers build the full prompt object including model, instructions, tools, `previous_response_id`, and `text.format`
- **`callOpenAI` vs `callOpenAIParsed`** — tool-calling (`responses.create`) and structured-output extraction (`responses.parse`) have different validation needs. `callOpenAIParsed<T>` uses a generic type param — the caller passes `zodTextFormat` inside params and the SDK handles parsing via `responses.parse<Params, T>()`. Trade-off: `T` is unconstrained, but callers are internal stages
- **`OpenAIResponse<T>` as the unified return type** — both functions return `{ id, output, usage }` instead of the full SDK `Response`. `id` for `previous_response_id` chaining, `output` is `ResponseOutputItem[]` or `T`, `usage` for token logging
- **Error handling** — See [CONVENTIONS.md — Error Handling](../../CONVENTIONS.md#error-handling). Section-specific: `APIError` and non-completed status → `ServiceUnavailableError`, missing `output_parsed` → `InternalError`, non-API errors rethrow unchanged
- **Callback-based `ask_user` tool** — handler receives `sendToUser` + `waitForResponse` callbacks, decoupled from transport. Testable with mocks, transport wired in Section 8
- **Stage cap (`MAX_STAGE_TOOL_CALLS`)** — prevents runaway loops if the model keeps asking questions. Fail-safe for cost and UX
- **`previous_response_id` for conversation state** — pass the previous response ID instead of manually building an input array. OpenAI maintains history server-side

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 3.1 | `UserProfileSchema` Zod schema (Zod 3) — extracted enums: `CurrencyEnum` (USD/ILS), `RiskToleranceEnum` (conservative/moderate/aggressive), `KnowledgeLevelEnum` (beginner/intermediate/advanced). Fields: `goal` (`.min(1)`), `currency`, `monthlyBudget` (`.positive().int()`), `riskTolerance`, `investmentHorizon` (`.min(1)`), `knowledgeLevel`. `UserProfile` type inferred via `z.infer` and exported from `pipeline.types.ts`. Other stage schemas deferred to their sections. | `src/server/schemas/pipeline.schema.ts`, `src/server/types/pipeline.types.ts` | Section 1 |
| 3.2 | OpenAI client singleton + service. Client: exports `openaiClient` instance. Service: `callOpenAI(params)` + `callOpenAIParsed<T>(params)`, both accept `ResponseCreateParamsNonStreaming` and return `OpenAIResponse<T>` (`{ id, output, usage }`). Retry via `withRetry`, status validation, `APIError` → `ServiceUnavailableError`, missing `output_parsed` → `InternalError`, token logging. Tests: 9 passing (mock via `vi.hoisted`). | `src/server/clients/openai.client.ts`, `src/server/services/openai/openai.service.ts`, `src/server/services/openai/openai.service.test.ts`, `src/server/services/openai/index.ts` | 1.8, 1.6 |
| 3.3 | OpenAI service mock helpers — shared across stage test files. Importing this file auto-mocks `#server/services/openai` via top-level `vi.mock`. Exports: `mockedCallOpenAI` / `mockedCallOpenAIParsed` (`vi.fn()` references via `vi.hoisted`), `createToolCallResponseMock(output: ResponseOutputItem[])` → `OpenAIResponse<ResponseOutputItem[]>`, `createParsedResponseMock<T>(output: T)` → `OpenAIResponse<T>`, `mockTokenUsage`. Both factories fill in default `id` and `usage`. Tests needing a specific `id` (e.g., `previous_response_id` chaining) can spread: `{ ...createToolCallResponseMock(output), id: 'custom' }`. | `src/server/mocks/openai.service.mock.ts` | 3.2 |
| 3.4 | `ask_user` tool: flat Responses API tool definition + callback-based handler (`sendToUser`, `waitForResponse`) | `src/server/pipeline/tools/ask-user.tool.ts` | 3.1 |
| 3.5 | Tool registry: maps stage names to allowed `ResponseTool[]` | `src/server/pipeline/tool-registry.ts` | 3.4 |
| 3.6 | Clarify stage: system prompt, tool-calling loop via `previous_response_id` chaining, profile extraction via `callOpenAIParsed()` with `temperature: 0`, stage cap at `MAX_STAGE_TOOL_CALLS` | `src/server/pipeline/stages/clarify/clarify.stage.ts` | 3.1, 3.2, 3.4, 3.5 |
| 3.7 | Clarify stage tests (detailed/minimal/contradictory input, extraction failure, cap) | `src/server/pipeline/stages/clarify/clarify.stage.test.ts` | 3.3, 3.6 |

**Runnable after**: Clarify stage works in isolation with mock callbacks, produces validated UserProfile
