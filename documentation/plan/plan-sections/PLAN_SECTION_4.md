## Section 4: Stage 2 — Research

**Goal**: Given `UserProfile`, determines target allocation via LLM, uses OpenAI built-in web search to find matching ETFs/קרנות כספיות, produces validated `ResearchSummary`. Brokerage data is hardcoded (not searched).

### Stage Contract

- **Input**: `UserProfile`
- **Output**: `ResearchSummary` — categories with allocation percentage + ETF list, validated via Zod (percentages sum to 100)
- **Tools**: OpenAI built-in `web_search` (Phase B only)

### Design Decisions

- **Three-phase structure** — Phase A (allocation via LLM), Phase B (ETF search via web search), Phase C (structured extraction via `previous_response_id` chaining). Separates allocation decision, product search, and extraction into distinct concerns.

- **LLM-based allocation** — allocation depends on nuanced factors (age, emergency fund, preferences, risk) that a deterministic formula handles poorly. Only application-specific context is added: output format, category name specificity (must be specific enough to guide ETF search), `investmentPreferences` → dedicated slices at stated percentages, קרן כספית as a valid Israeli allocation category, and an emergency fund + age nudge (young ≤50 with emergency fund can eliminate bonds; older >50 needs bonds regardless — evals showed the LLM defaults to 40% bonds for a 28-year-old without this nudge).

- **`investmentPreferences` percentage split** — when a user names multiple instruments, the clarify stage asks for a percentage split (e.g. "80% S&P 500, 20% TLV-125"). The allocation LLM uses the stated percentages to create dedicated slices; without this, it would guess the split.

- **Hardcoded brokerage** — Israeli brokerage options change rarely. No Interactive Brokers — tax reporting complexity doesn't fit a "lazy" product. Passed directly to the plan stage, not through research.

- **Domain-restricted search** — `allowed_domains` restricts to curated Israeli finance sites. Unrestricted search produced generic international results.

- **No `SearchFailedError` hard gate** — empty/low-quality output is caught by Zod validation (`.min(1)` on ETF array and string fields).

- **`percentage` on `ResearchCategorySchema`** — Phase C extracts the allocation percentage per category from the allocation plan present in the context chain. This gives the plan stage a single unified object (category + percentage + ETFs) without needing to join against `AllocationPlan` by name.

- **`ResearchSummary` as stage output** — `AllocationPlan` (Phase A internal output) is not exposed in the stage result. The plan stage only needs `ResearchSummary`; keeping `AllocationPlan` separate would require downstream joining by category name.

- **קרן כספית as default buffer** — for Israeli investors with no stated bond preference, the default defensive allocation is קרן כספית (Israeli money market). Shekel-denominated, no currency risk, simpler tax reporting. Bonds remain valid if the user explicitly requests them.

- **`sourceUrl` uses plain string** — OpenAI's structured output API rejects `"format": "uri"`. `z.string().url()` produces that format, so `sourceUrl` uses `z.string().min(1)` instead.

- **`buildSourceParams` shared utility** — the `source: string | ResponseInputItem[]` branching (previousResponseId vs transcript) is shared across all extraction functions via `pipeline/lib/build-source-params.ts`.

- **Models** — `gpt-5.4-mini` for Phase B (nano doesn't support web search), `gpt-5.4-nano` for A and C. `reasoning: low` for all (medium caused timeouts).

### Stage Flow

1. `buildAllocationPlan(profile)` → `AllocationPlan` (Phase A — nano, no tools)
2. `callOpenAI` + web_search → research text (Phase B — mini, guided by allocation plan)
3. `extractResearchSummary(phaseB.id)` → `ResearchSummary` (Phase C — nano, extraction)

### Completed Tasks

| Task | Summary |
|------|---------|
| 4.4a | `buildAllocationPlan(profile)` in `research.allocation.ts` — LLM allocation via `callOpenAIParsed` + evals (Story 1, 3, 12 + older investor) |
| 4.4b | `extractResearchSummary(source)` in `research.extraction.ts` — Phase C extraction + evals (Story 1, 3; assertions on tickers, expense ratios, percentages, trackingIndex) |

### Remaining Tasks

**4.4c — Phase B + orchestration + unit tests + full-loop eval**

`runResearchStage(profile): Promise<ResearchSummary>` in `research.stage.ts`. Orchestrates: `buildAllocationPlan` → Phase B web search (`gpt-5.4-mini`, `getStageTools("research")`) → `extractResearchSummary(phaseB.id)`.

Unit tests (`research.stage.test.ts`) — mock `callOpenAI` and `callOpenAIParsed`:
1. Happy path — returns `ResearchSummary`
2. Phase A error (`ServiceUnavailableError`) — Phase B not called
3. Phase B error (`ServiceUnavailableError`) — Phase C not called
4. Phase C error (`InternalError`)

Full-loop eval (`research.stage.eval.ts`) — live OpenAI + web search. Schema validation primary, exact equality only for explicit input values.

**4.4d — Update extraction evals with real web search output shape**

After 4.4c's full-loop eval reveals the actual Phase B output format (url_citation annotations, web_search_call items), update 4.4b's extraction evals to use realistic output. Fix extraction prompt if real output exposes gaps.

**4.7 — Doc updates**

Update STATUS.md, PLAN_SECTION_4.md, and TESTING.md to reflect completed implementation and any decisions discovered during evals.
