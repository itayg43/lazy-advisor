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

### Task 3.8 — Upfront portfolio defaults (complete)

When `investmentPreferences` is `"none"`, the clarify stage surfaces two trade-off questions before the research phase runs:

1. **Geographic scope (stocks)** — three options: all-world including emerging markets (FTSE All-World / MSCI ACWI, ~10%/yr 10yr), developed markets only (MSCI World, ~11%/yr), or US/Israeli concentrated (S&P 500, NASDAQ, TLV-125, ~13%/yr). Compounding difference shown concretely using the user's actual amount and timeline. Past-performance caveat included. No silent default.
2. **Buffer allocation** — קרן כספית (Israeli money market, shekel-denominated, no currency risk, ~4–5% yield) vs bonds (slightly higher return potential but interest rate risk and currency exposure). Leans toward recommending קרן כספית for Israeli investors.

Guard: skip the relevant question if the user has already stated a preference for that dimension.

**Changes made:** `clarify.stage.ts` system prompt (Portfolio Defaults section + updated Output Format + updated examples), `clarify.extraction.ts` Example 1, `WORKFLOW_EXAMPLES.md` Story 1 (portfolio defaults conversation added, plan updated to קרן כספית and simplified to two-fund portfolio: VWRA + קרן כספית).
