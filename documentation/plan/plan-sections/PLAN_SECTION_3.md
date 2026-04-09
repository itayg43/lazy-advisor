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
- **Portfolio defaults before research** — when `investmentPreferences` is `"none"`, the clarify stage asks two questions before handing off: (1) equity allocation, (2) buffer allocation. Prevents the research phase from silently picking sides on high-impact decisions
- **Equity allocation as open preference capture, not forced choice** — presents five anchors with ~10-year returns and trade-offs (FTSE All-World ~10%/yr, MSCI World ~11%/yr, S&P 500 ~13%/yr, NASDAQ-100 ~18%/yr, TLV-125 ~8%/yr NIS). Any combination, split, or 100% concentration is valid — trade-offs are presented, not constraints. Sector ETFs (healthcare, financials, energy, real estate) are also surfaced. If multiple instruments are named without a split, follow up for the percentage
- **Buffer defaults to קרן כספית without offering bonds** — all users are Israeli; קרן כספית (shekel-denominated, ~4–5% yield, capital-stable) is the appropriate default. Bonds are not presented as an option but are captured if the user volunteers them
