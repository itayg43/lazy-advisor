## Section 4: Stage 2 — Research

**Goal**: Given `UserProfile`, determines target allocation via LLM, then uses OpenAI's built-in web search to find matching ETFs/קרנות כספיות, produces validated `ResearchStageResult`. Brokerage data is hardcoded (not searched).

### Stage Contract

- **Input**: `UserProfile` (includes `investmentPreferences` with percentage split if multiple instruments)
- **Output**: `ResearchStageResult = { allocationPlan: AllocationPlan, researchSummary: ResearchSummary }` — both validated via Zod
- **Tools**: OpenAI built-in `web_search` (Phase B only)
- **Key**: Allocation drives ETF search. Stage 3 receives structured results only — never raw HTML/text.

### Design Decisions

- **Three-phase structure** — Phase A (allocation via LLM), Phase B (ETF search via web search), Phase C (structured extraction via `previous_response_id` chaining). Separates allocation decision, product search, and extraction into distinct concerns.

- **LLM-based allocation** — allocation depends on nuanced factors (age, emergency fund, preferences, risk) that a deterministic formula handles poorly. No rigid percentage guidelines in the prompt — the LLM already has financial knowledge from training. Only application-specific context is added: output format, category name specificity (must be specific enough to guide ETF search), `investmentPreferences` → dedicated slices at stated percentages, קרן כספית as a valid Israeli allocation category, and an emergency fund + age nudge (see below).

- **Emergency fund + age in prompt** — young investors (≤50) with an emergency fund can reduce or eliminate bonds; older investors (>50) need bonds regardless. Included as a permissive nudge, not a prescriptive rule — evals showed the LLM defaults to conventional allocations (40% bonds for a 28-year-old) without it.

- **`investmentPreferences` percentage split** — when a user names multiple instruments, the clarify stage asks for a percentage split (e.g. "80% S&P 500, 20% TLV-125"). The allocation LLM uses the stated percentages to create dedicated slices; without this, it would guess the split.

- **Hardcoded brokerage** — Israeli brokerage options change rarely. No Interactive Brokers — tax reporting complexity doesn't fit a "lazy" product. Passed directly to the plan stage, not through research.

- **Domain-restricted search** — `allowed_domains` restricts to curated Israeli finance sites. Unrestricted search produced generic international results.

- **No `SearchFailedError` hard gate** — empty/low-quality output is caught by Zod validation (`.min(1)` on ETF array and string fields).

- **Citation annotations** — Phase C extracts `sourceUrl` from Phase B's `url_citation` annotations via `previous_response_id` chaining.

- **`sourceUrl` uses plain string, not `.url()`** — OpenAI's structured output API rejects `"format": "uri"` in the generated JSON schema. `z.string().url()` produces that format, so `sourceUrl` uses `z.string().min(1)` instead.

- **`percentage` on `ResearchCategorySchema`** — the plan stage needs category + percentage + ETFs together. Keeping them separate in `AllocationPlan` and `ResearchSummary` would require joining by category name, which is fragile. Phase C extracts the percentage directly from the allocation plan already present in the context chain.

- **קרן כספית as default buffer** — for Israeli investors with no stated bond preference, the default defensive allocation is קרן כספית (Israeli money market), not a global bond ETF (e.g. AGGU). קרן כספית is shekel-denominated with no currency risk and simpler tax reporting. Bonds remain valid if the user explicitly requests them.

- **`buildSourceParams` shared utility** — the `source: string | ResponseInputItem[]` branching (previousResponseId vs transcript) is identical across all extraction functions. Extracted to `pipeline/lib/build-source-params.ts` to avoid duplication.

- **Models** — `gpt-5.4-mini` for Phase B (nano doesn't support web search), `gpt-5.4-nano` for A and C. `reasoning: low` for all (medium caused timeouts).

### Stage Flow

1. `buildAllocationPlan(profile)` → `AllocationPlan` (Phase A — nano, no tools)
2. `callOpenAI` + web_search → research text (Phase B — mini, guided by allocation plan)
3. `extractResearchSummary(phaseB.id)` → `ResearchSummary` (Phase C — nano, extraction)

### Task 4.4a — Phase A: allocation function + evals ✅

`buildAllocationPlan(profile: UserProfile): Promise<AllocationPlan>` in `research.allocation.ts`. Uses `callOpenAIParsed` with `gpt-5.4-nano`.

**Evals** (`research.allocation.eval.ts`) — Story 1, Story 3, Story 12 profiles + older investor:
- Young + emergency fund → bonds ≤ 20%
- Aggressive + emergency fund → bonds ≤ 10%
- Older investor (58yo) → bonds > 0% even with emergency fund
- Multiple preferences with % split → dedicated slices at exact stated percentages

### Task 4.4b — Phase C: extraction function + evals ✅

`extractResearchSummary(source: string | ResponseInputItem[]): Promise<ResearchSummary>` in `research.extraction.ts`.

**Evals** (`research.extraction.eval.ts`) — Story 1 and Story 3 research text → `extractResearchSummary`. Assertions on tickers, expense ratios, percentages, and trackingIndex (including default "none" for a thematic ETF with no index mentioned).

### Task 4.4c — Phase B + orchestration + unit tests + full-loop eval

`runResearchStage(profile): Promise<ResearchStageResult>` in `research.stage.ts`. Orchestrates: `buildAllocationPlan` → Phase B web search (`gpt-5.4-mini`, `getStageTools("research")`) → `extractResearchSummary(phaseB.id)`.

**Unit tests** (`research.stage.test.ts`) — mock `callOpenAI` and `callOpenAIParsed`:
1. Happy path — returns `ResearchStageResult`
2. Phase A error (`ServiceUnavailableError`) — Phase B not called
3. Phase B error (`ServiceUnavailableError`) — Phase C not called
4. Phase C error (`InternalError`)

**Full-loop eval** (`research.stage.eval.ts`) — live OpenAI + web search. Schema validation primary, exact equality only for explicit input values.

### Task 4.4d — Update extraction evals with real web search output shape

After 4.4c's full-loop eval reveals the actual Phase B output format (url_citation annotations, web_search_call items), update 4.4b's extraction evals to use realistic output instead of simplified handwritten text. Fix extraction prompt if real output exposes gaps.

### Task 4.7 — Doc updates

Update STATUS.md, PLAN_SECTION_4.md, and TESTING.md to reflect completed implementation and any decisions discovered during evals.
