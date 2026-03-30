## Section 4: Stage 2 — Research

**Goal**: Given UserProfile, uses OpenAI's built-in web search to gather current financial data, produces validated ResearchSummary.

### Stage Contract

- **System prompt**: Focused on financial research — what to search, how to evaluate ETFs, what data points matter
- **Input**: Structured user profile from Stage 1
- **Output**: Structured research summary (`{ recommended_etfs: [{ ticker, er, reasoning, risks, source_url }], brokerage_recommendation, allocation_rationale }`). Each recommendation includes a `source_url` so the user can verify the data. Research freshness is derived from the plan's `createdAt` in the DB — no separate timestamp needed
- **Tools**: OpenAI built-in `web_search` — the model searches for current financial data autonomously. No custom search tool handler needed
- **Key**: Raw search results are summarized and compressed here. Stage 3 never sees the raw HTML/text — only the structured summary. This is what keeps context clean
- **Events**: `search_progress` (✓ Searched "...")

### Design Decisions

- **Built-in web search over Tavily** — OpenAI's `{ type: "web_search" }` tool is passed alongside the stage's function tools. The model decides when and what to search autonomously. This eliminates the need for a separate Tavily client, mock, error class, and custom search tool handler. Trade-off: less control over search queries and result quality (black box). If research output quality is insufficient, Tavily is the documented fallback (see Section 3 design decisions)
- **No `SearchFailedError` hard gate** — since web search is handled internally by OpenAI, individual search failures are not surfaced as exceptions. Instead, validate that the model's `ResearchSummary` output contains substantive research content (e.g., non-empty sources/findings). If the model produces an empty or low-quality summary, treat it as a validation failure

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 4.1 | Register `web_search` built-in tool in registry for `research` and `iterate` stages | `src/server/pipeline/tools/index.ts` | 3.5 |
| 4.2 | Research stage: system prompt, `callOpenAI` with `web_search` tool, `callOpenAIParsed` for ResearchSummary extraction via Zod validation | `src/server/pipeline/stages/research/research.stage.ts` | 3.1, 3.2, 4.1 |
| 4.3 | Research stage tests (happy path, validation failure, empty research content) | `src/server/pipeline/stages/research/research.stage.test.ts` | 3.3, 4.2 |

**Runnable after**: Research stage works in isolation, produces validated ResearchSummary
