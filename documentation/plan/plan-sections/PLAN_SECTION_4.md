## Section 4: Stage 2 — Research

> **Status: Task 4.1 complete. Tasks 4.2–4.7 pre-implementation.** Design decisions may change during implementation. See [STATUS.md](../../STATUS.md) for task completion status.

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
- **Emergency fund + age interaction** — young investors (20s-40s) with emergency fund can reduce/skip bonds. Older investors (50+) still need bonds for sequence-of-returns protection. קרן כספית as viable bond alternative
- **Domain-restricted search** — `allowed_domains` restricts to curated Israeli finance sites. Unrestricted search produced generic international results
- **No `SearchFailedError` hard gate** — empty/low-quality output caught by Zod validation (`.min(1)` on ETF array and string fields)
- **Citation annotations** — Phase C extracts `sourceUrl` from Phase B's `url_citation` annotations via `previous_response_id` chaining
- **`gpt-5.4-mini` for Phase B** (web search), **`gpt-5.4-nano` for A and C** — nano doesn't support web search. `reasoning: low` for all (medium caused timeouts)

### Stage Flow

1. `buildAllocationPlan(profile)` → `AllocationPlan` (nano, no web search)
2. `callOpenAI` + web_search → research text (guided by allocation plan)
3. `extractResearchSummary` → `ResearchSummary` (extraction)

---

### Completed

| Task | Summary |
|------|---------|
| 4.1 | `investmentPreferences` field added to `UserProfileSchema` (free text, defaults to `"none"`). Clarify prompt updated to ask about sectors, markets, and specific instruments. 2 new evals (extraction + full-loop) |

### Task 4.2 — Schemas, types, and web_search tool registration

Add `RecommendedEtfSchema` (with `trackingIndex`), `ResearchSummarySchema`, `AllocationPlanSchema` to `pipeline.schema.ts`. Inferred types to `pipeline.types.ts`. Register `WEB_SEARCH_TOOL` with `user_location` (IL) and `filters.allowed_domains` in tool registry.

### Task 4.3 — Hardcoded brokerage table + shared utilities

Create `src/server/pipeline/data/` with `ISRAELI_BROKERAGES` constant (4 brokers: Meitav, IBI, Psagot, Excellence). Create `src/server/pipeline/lib/` with `buildProfileSummary(profile)` (shared across stages) and `buildAllocationSummary` (formats allocation plan as text for research prompt). Barrel exports for both directories.

### Task 4.4 — Research stage implementation (three-phase) with prompts

Create `src/server/pipeline/stages/research/research.stage.ts`. Implements `runResearchStage(profile): Promise<ResearchStageResult>` following the three-phase stage flow above.

**Prompts:**
- **Allocation**: target allocation from profile, emergency fund + age interaction, investment preferences → category-specific slices
- **Research**: financial researcher role, domain-restricted sources, searches for ETFs + קרנות כספיות matching allocation slices
- **Extraction**: extract structured `ResearchSummary` from research text, field rules for each schema field

### Task 4.5 — Research stage unit tests

**File created:**
- `src/server/pipeline/stages/research/research.stage.test.ts`

Mock pattern follows [TESTING.md](../../TESTING.md) (`vi.hoisted` + `vi.mock`). Mock data uses realistic Israeli investor profiles, allocation slices summing to 100%, and ETF entries with TASE tickers.

**Test scenarios** (behavior-only — no implementation detail assertions):
1. **Happy path** — returns `ResearchStageResult` with both `allocationPlan` and `researchSummary`
2. **Propagates allocation error** (Phase A) — `ServiceUnavailableError`; research phase not called
3. **Propagates research error** (Phase B) — `ServiceUnavailableError`; extraction phase not called
4. **Propagates extraction error** (Phase C) — `InternalError`

### Task 4.6 — Research stage evals

Export `extractResearchSummary` and `buildAllocationPlan` for direct eval usage (same `ExtractionParams` pattern as clarify). Two-layer eval structure per [TESTING.md](../../TESTING.md):

- **Extraction-only**: handwritten research text → `extractResearchSummary`. Tight assertions on tickers, expense ratios, trackingIndex
- **Allocation**: various `UserProfile` inputs → `buildAllocationPlan`. Tests emergency fund/age interaction, investment preferences. Slices must sum to 100%
- **Full-loop**: `runResearchStage` against live OpenAI + web search. Schema validation primary, exact equality only for explicit input values

### Task 4.7 — Doc updates

Update STATUS.md, PLAN_SECTION_4.md, and TESTING.md to reflect completed implementation, schema decisions discovered during evals, and research-specific eval guidance.
