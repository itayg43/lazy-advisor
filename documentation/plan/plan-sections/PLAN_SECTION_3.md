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

When `investmentPreferences` is `"none"`, the clarify stage asks two questions before handing off to research:

1. **Equity allocation** — presents five illustrative anchors with ~10-year annualized returns and key trade-offs: FTSE All-World / MSCI ACWI (~10%/yr), MSCI World developed-only (~11%/yr), S&P 500 (~13%/yr), NASDAQ-100 (~18%/yr, high volatility), TLV-125 (~8%/yr in NIS). Any combination or split is valid — custom mixes, 100% concentration in a single index, or sector-specific ETFs (healthcare, financials, energy, real estate). 100% NASDAQ is a valid answer; trade-offs are presented, not blocked. Compounding gap shown concretely using the user's actual amount and timeline. Past-performance caveat required. If multiple instruments are named without a split, follow up for the percentage before treating the answer as complete.
2. **Buffer allocation** — explains קרן כספית (Israeli money market, shekel-denominated, no currency risk, ~4–5% yield) and asks if the user is comfortable with it. No bonds option presented — all users are Israeli and קרן כספית is the appropriate default. If the user volunteers a different preference, capture it.

Guard: skip each sub-question if the user has already stated a preference for that dimension.

Output Format is a sequential 1→2→3 decision tree: (1) any required field fails → ask, (2) all required fields pass and investmentPreferences is "none" and defaults not yet asked → ask defaults, (3) otherwise → confirm done.

**Changes made:** `clarify.stage.ts` (Portfolio Defaults section redesigned, Output Format rewritten, Example 3 replaced with actual ask_user text and follow-up variants), `clarify.extraction.ts` Example 1 (updated to show clean percentage split with TLV-125), `clarify.stage.eval.ts` (Story 1 updated to 70/30 FTSE All-World + TLV-125 split; Story 7 gets third scripted response for portfolio defaults turn), `clarify.extraction.eval.ts` (Story 1 and Story 1 extended merged into one full-flow test; Story 13 added for 100% NASDAQ), `WORKFLOW_EXAMPLES.md` Story 1 (portfolio defaults conversation updated to reflect new single equity question).
