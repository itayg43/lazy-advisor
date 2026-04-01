## Section 3: Stage 1 — Clarify (Completed)

**Goal**: Given raw goal text, calls OpenAI (Responses API) with `ask_user` tool, asks adaptive questions, produces validated UserProfile via structured output.

### Design Decisions

- **Responses API over Chat Completions** — native tool calling and structured output via `responses.parse()`. Trade-off: fewer community examples
- **`callOpenAI` vs `callOpenAIParsed`** — tool-calling and structured-output extraction have different validation needs, justifying two separate service functions
- **Callback-based `ask_user` tool** — decoupled from transport via `sendToUser` + `waitForResponse` callbacks. Transport wired in Section 8
- **Stage cap throws `InternalError`** — throws instead of extracting partial data because downstream stages depend on a complete profile
- **`previous_response_id` does NOT carry `instructions` forward** — all chained calls must re-pass `instructions`. Omitting them caused the model to run without the system prompt (OpenAI SDK gotcha)
- **HTTP over streaming for OpenAI calls** — stages are tool-heavy (short JSON), not long prose. Streaming complicates tool call handling. Revisit for plan output stage (Section 5)
- **Built-in web search over Tavily** — eliminates Tavily client, mock, error class, and search tool handler. Trade-off: less control (black box). Tavily is the documented fallback

### Tasks (Completed)

| Task | Summary |
|------|---------|
| 3.1 | `UserProfileSchema` Zod schema — 11 fields with enums, bounds, and inferred types |
| 3.2 | OpenAI client singleton + service (`callOpenAI` / `callOpenAIParsed`) with retry and error handling (9 tests) |
| 3.3 | OpenAI service shared mock data (`mockTokenUsage`, response factories) |
| 3.4 | `ask_user` tool — callback-based handler with Zod-validated args |
| 3.4b | Logger utility — `createLogger(tag)` factory with human-readable format |
| 3.5 | Tool registry — maps stage names to allowed `Tool[]` |
| 3.6 | Clarify stage — prompt with Field Validation, tool-calling loop, profile extraction |
| 3.7 | Clarify stage unit tests (6 passing) |
| 3.7b | Clarify stage evals — extraction-only (4) + full-loop (3) |

**Runnable after**: Clarify stage works in isolation with mock callbacks, produces validated UserProfile
