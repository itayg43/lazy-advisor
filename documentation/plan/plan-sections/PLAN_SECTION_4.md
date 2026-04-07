## Section 4: Stage 2 — Research

**Goal**: Given UserProfile, determines target allocation via LLM, then uses OpenAI's built-in web search to find matching ETFs/קרנות כספיות, produces validated `ResearchStageResult` containing both `AllocationPlan` and `ResearchSummary`. Brokerage data is hardcoded (not searched).

### Stage Contract

- **Input**: `UserProfile` from Stage 1 (includes `investmentPreferences` field)
- **Output**: `ResearchStageResult = { allocationPlan: AllocationPlan, researchSummary: ResearchSummary }` — both validated via Zod schemas
- **Tools**: OpenAI built-in `web_search` with `user_location` (Phase B only — allocation phase uses no tools)
- **Key**: Allocation drives ETF selection. Raw search results are summarized and compressed here. Stage 3 never sees the raw HTML/text — only the structured results plus the hardcoded brokerage table

### Design Decisions

- **Three-phase structure**: Phase A (allocation via LLM), Phase B (ETF search via web search), Phase C (structured extraction via `previous_response_id` chaining). Separates allocation decision, product search, and extraction into distinct concerns
- **LLM-based allocation over deterministic** — allocation depends on nuanced factors (emergency fund as bond substitute for young but not old investors, קרן כספית as bond alternative, user investment preferences like sector tilts) that a formula would handle poorly
- **Hardcoded brokerage over web search** — brokerage options in Israel change rarely. No Interactive Brokers — tax reporting complexity doesn't fit a "lazy" product. Passed directly to plan stage, not through research
- **`investmentPreferences` field** — free text on `UserProfile`. Allocation LLM uses it to create category-specific slices (e.g., "S&P 500 and TLV-125" → slices for those). ETF search then targets those categories
- **`investmentPreferences` weighting** — when a user mentions multiple specific instruments, the clarify stage should ask about relative weighting (e.g., "roughly 70/30 or equal?") so the allocation LLM has an explicit signal rather than guessing. Without this, the allocation prompt cannot reason about the split and must default to equal weight.
- **Emergency fund + age interaction** — young investors (20s-40s) with emergency fund can reduce/skip bonds. Older investors (50+) still need bonds for sequence-of-returns protection. קרן כספית as viable bond alternative
- **No percentage guidelines in allocation prompt** — the allocation prompt does not include rigid percentage rules (e.g., "conservative = 40–60% bonds"). The LLM already has this financial knowledge from training; adding rules risks overriding nuanced reasoning on edge cases (e.g., a young aggressive investor with specific preferences and an emergency fund may validly hold 100% equity). Only application-specific context is included: output format requirements, category name specificity, investment preferences → dedicated slices, and קרן כספית as an Israeli-specific instrument the LLM may not weight correctly on its own.
- **One few-shot example in allocation prompt** — one example (young investor with specific preferences → 100% equity, 50/50 split) demonstrates category name format and that full-equity allocations are valid. A second example covering older investors was dropped because it re-introduced the guideline pattern (prescribing bonds for age > 50) that the no-guidelines decision deliberately excludes.
- **Domain-restricted search** — `allowed_domains` restricts to curated Israeli finance sites. Unrestricted search produced generic international results
- **No `SearchFailedError` hard gate** — empty/low-quality output caught by Zod validation (`.min(1)` on ETF array and string fields)
- **Citation annotations** — Phase C extracts `sourceUrl` from Phase B's `url_citation` annotations via `previous_response_id` chaining
- **`gpt-5.4-mini` for Phase B** (web search), **`gpt-5.4-nano` for A and C** — nano doesn't support web search. `reasoning: low` for all (medium caused timeouts)

### Stage Flow

1. `buildAllocationPlan(profile)` → `AllocationPlan` (nano, no web search)
2. `callOpenAI` + web_search → research text (guided by allocation plan)
3. `extractResearchSummary` → `ResearchSummary` (extraction)

### Task 4.4a — Phase A: allocation function + evals

Create `src/server/pipeline/stages/research/research.extraction.ts`. Implement `buildAllocationPlan(profile: UserProfile): Promise<AllocationPlan>` using `callOpenAIParsed` with `gpt-5.4-nano`.

**Allocation prompt rules:** target allocation from profile, emergency fund + age interaction (young ≤50 with emergency fund can reduce/skip bonds; older >50 needs bonds regardless), investment preferences → category-specific slices, category names must be specific enough to guide ETF search.

Export `buildAllocationPlan` for direct eval usage.

**Evals** (`research.allocation.eval.ts`):
- Various `UserProfile` inputs → `buildAllocationPlan`. Slices must sum to 100%.
- Tests: emergency fund + young investor reduces bonds; older investor keeps bonds even with emergency fund; investment preferences produce category-specific slices.

### Task 4.4b — Phase C: extraction function + evals

Add `extractResearchSummary(source: string | ResponseInputItem[]): Promise<ResearchSummary>` to `research.extraction.ts`. Uses `callOpenAIParsed` with `gpt-5.4-nano`, same `source` pattern as `extractUserProfile` (string = previousResponseId for production; array = full transcript for evals).

**Extraction prompt rules:** extract structured `ResearchSummary` from research text; field rules for ticker, name, expenseRatio, trackingIndex (default "none"), sourceUrl from `url_citation` annotations.

**Evals** (`research.extraction.eval.ts`):
- Handwritten research text → `extractResearchSummary`. Tight assertions on tickers, expense ratios, trackingIndex.

### Task 4.4c — Phase B + orchestration + unit tests + full-loop eval

Create `src/server/pipeline/stages/research/research.stage.ts`. Implements `runResearchStage(profile): Promise<ResearchStageResult>` following the three-phase flow: `buildAllocationPlan` → Phase B web search call (`gpt-5.4-mini`, `getStageTools("research")`) → `extractResearchSummary(phaseB.id)`.

**Research prompt rules:** financial researcher role, domain-restricted sources (already enforced by `WEB_SEARCH_TOOL` config), searches for ETFs + קרנות כספיות per allocation slice.

**Unit tests** (`research.stage.test.ts`) — mock `callOpenAI`, `callOpenAIParsed`, realistic Israeli investor mock data:
1. **Happy path** — returns `ResearchStageResult` with both `allocationPlan` and `researchSummary`
2. **Propagates allocation error** (Phase A) — `ServiceUnavailableError`; Phase B not called
3. **Propagates research error** (Phase B) — `ServiceUnavailableError`; Phase C not called
4. **Propagates extraction error** (Phase C) — `InternalError`

**Full-loop eval** (`research.stage.eval.ts`): `runResearchStage` against live OpenAI + web search. Schema validation primary, exact equality only for explicit input values.

### Task 4.4d — Update extraction evals with real web search output shape

After 4.4c's full-loop eval reveals the actual Phase B output format (url_citation annotations, web_search_call items, response structure), update 4.4b's extraction evals to use realistic web search output instead of simplified handwritten text. If the real output exposes prompt gaps, fix the extraction prompt too.

### Task 4.7 — Doc updates

Update STATUS.md, PLAN_SECTION_4.md, and TESTING.md to reflect completed implementation and any schema decisions discovered during evals.
