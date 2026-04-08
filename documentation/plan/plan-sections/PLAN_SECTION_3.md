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

### Task 3.8 — Upfront portfolio philosophy validation (pending)

When `investmentPreferences` is `"none"`, the clarify stage should proactively surface two trade-off questions before the research phase runs:

1. **Geographic scope (stocks)** — all-world diversification (MSCI World / FTSE All-World) vs concentrated US/Israeli indices (S&P 500, NASDAQ, TLV-125). Include real 10-year performance context so the user can choose with eyes open. Do not default silently to all-world.
2. **Buffer allocation** — קרן כספית (Israeli money market, shekel-denominated, no currency risk) vs bonds (Israeli or global). Default recommendation is קרן כספית; explain the tradeoff.

Guard: skip the relevant question if the user has already stated a preference for that dimension.

**Scope of changes:** `clarify.stage.ts` system prompt, `WORKFLOW_EXAMPLES.md` Story 1 (update plan output to reflect קרן כספית instead of AGGU, and show the validation conversation).
