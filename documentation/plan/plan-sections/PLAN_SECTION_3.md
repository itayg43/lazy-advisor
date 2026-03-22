## Section 3: Stage 1 — Clarify

**Goal**: Given raw goal text, calls OpenAI (Responses API) with `ask_user` tool, asks adaptive questions, produces validated UserProfile via structured output.

**Reference**: OpenAI integration patterns based on `ai-task-assistant/backend/services/ai/` — client singleton, `responses.parse()` with `zodTextFormat()`, `parseWithValidation<T>()` pattern (status + output_parsed checks), token usage via `input_tokens`/`output_tokens`, `temperature: 0` for deterministic structured output.

### Design Decisions

- **Responses API over Chat Completions** — native tool calling and structured output via `responses.parse()`, less manual work than `chat.completions`. Trade-off: fewer community examples
- **Two client functions (`callOpenAI` / `callOpenAIParsed`)** — tool-calling and structured-output extraction have different validation. Splitting keeps each function simple
- **Callback-based `ask_user` tool** — handler receives `sendToUser` + `waitForResponse` callbacks, decoupled from transport. Testable with mocks, transport wired in Section 8
- **Stage cap (`MAX_STAGE_TOOL_CALLS`)** — prevents runaway loops if the model keeps asking questions. Fail-safe for cost and UX
- **`previous_response_id` for conversation state** — pass the previous response ID instead of manually building an input array. OpenAI maintains history server-side

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 3.1 | `UserProfileSchema` Zod schema (Zod 3) — extracted enums: `CurrencyEnum` (USD/ILS), `RiskToleranceEnum` (conservative/moderate/aggressive), `KnowledgeLevelEnum` (beginner/intermediate/advanced). Fields: `goal` (`.min(1)`), `currency`, `monthlyBudget` (`.positive().int()`), `riskTolerance`, `investmentHorizon` (`.min(1)`), `knowledgeLevel`. `UserProfile` type inferred via `z.infer` and exported from `pipeline.types.ts`. Other stage schemas deferred to their sections. | `src/server/schemas/pipeline.schema.ts`, `src/server/types/pipeline.types.ts` | Section 1 |
| 3.2 | OpenAI client wrapper (Responses API): `callOpenAI()` for tool calling (`responses.create`) + `callOpenAIParsed()` for structured output (`responses.parse` + `zodTextFormat`). Validates `response.status === "completed"` and `output_parsed` exists. Retry via `withRetry`, token logging. Models: `gpt-5.4-mini` / `gpt-5.4-nano`. | `src/server/clients/openai.client.ts` | 1.8, 1.6 |
| 3.3 | Mock OpenAI test helpers: `createMockToolCallResult()`, `createMockTextResult()`, `mockTokenUsage`. Mock pattern: mock `openai` default class with `responses.parse`/`responses.create` as `vi.fn()`. | `src/server/mocks/openai.mock.ts` | 3.2 |
| 3.4 | `ask_user` tool: flat Responses API tool definition + callback-based handler (`sendToUser`, `waitForResponse`) | `src/server/pipeline/tools/ask-user.tool.ts` | 3.1 |
| 3.5 | Tool registry: maps stage names to allowed `ResponseTool[]` | `src/server/pipeline/tool-registry.ts` | 3.4 |
| 3.6 | Clarify stage: system prompt, tool-calling loop via `previous_response_id` chaining, profile extraction via `callOpenAIParsed()` with `temperature: 0`, stage cap at `MAX_STAGE_TOOL_CALLS` | `src/server/pipeline/stages/clarify/clarify.stage.ts` | 3.1, 3.2, 3.4, 3.5 |
| 3.7 | Clarify stage tests (detailed/minimal/contradictory input, extraction failure, cap) | `src/server/pipeline/stages/clarify/clarify.stage.test.ts` | 3.3, 3.6 |

**Runnable after**: Clarify stage works in isolation with mock callbacks, produces validated UserProfile
