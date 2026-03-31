## Section 4: Stage 2 — Research

> **Status: Pre-implementation.** This section describes planned architecture — no code has been implemented yet. Design decisions may change during implementation. See [STATUS.md](../../STATUS.md) for task completion status.

**Goal**: Given UserProfile, determines target allocation via LLM, then uses OpenAI's built-in web search to find matching ETFs/קרנות כספיות, produces validated `ResearchStageResult` containing both `AllocationPlan` and `ResearchSummary`. Brokerage data is hardcoded (not searched).

### Stage Contract

- **Input**: `UserProfile` from Stage 1 (includes `investmentPreferences` field)
- **Output**: `ResearchStageResult = { allocationPlan: AllocationPlan, researchSummary: ResearchSummary }` — both validated via Zod schemas
- **Tools**: OpenAI built-in `web_search` with `user_location` (Phase B only — allocation phase uses no tools)
- **Key**: Allocation drives ETF selection. Raw search results are summarized and compressed here. Stage 3 never sees the raw HTML/text — only the structured results plus the hardcoded brokerage table

### Design Decisions

- **Three-phase structure** (refactored from two-phase in 4.5–4.11): Phase A calls `callOpenAIParsed<AllocationPlan>` with `gpt-5.4-nano` to determine target allocation from user profile (no web search). Phase B calls `callOpenAI` with `web_search` tool to find ETFs/קרנות כספיות matching each allocation slice. Phase C calls `callOpenAIParsed<ResearchSummary>` chained via `previous_response_id` to extract structured data. Separates allocation decision, product search, and extraction into distinct concerns
- **LLM-based allocation over deterministic** — allocation depends on nuanced factors (emergency fund as bond substitute for young investors but not older ones, קרן כספית as bond alternative, user investment preferences like sector tilts) that a formula would handle poorly. Using `gpt-5.4-nano` with low reasoning keeps it fast (~1-2s) while handling edge cases naturally
- **Hardcoded brokerage over web search** — brokerage options in Israel change rarely. Static `ISRAELI_BROKERAGES` constant (4 brokers: Meitav, IBI, Psagot, Excellence) saves ~2 search queries per run. No Interactive Brokers — tax reporting complexity doesn't fit a "lazy" product. Data sourced from lazyinvestor.co.il. Passed directly to plan stage, not through research
- **`investmentPreferences` field** — free text on `UserProfile`, defaults to `"none"`. Clarify stage asks about sectors, markets, specific instruments. Allocation LLM uses it to create category-specific slices (e.g., user says "S&P 500 and TLV-125" → allocation creates slices for those). ETF search then targets those categories
- **Emergency fund + age interaction in allocation prompt** — young investors (20s-40s) with emergency fund can reduce/skip bonds (emergency fund serves stability role). Older investors (50+) still need bonds for sequence-of-returns protection regardless. קרן כספית mentioned as viable bond alternative for stability — simpler, bank-bought, same-day liquidity
- **`trackingIndex` field** — free-text field on `RecommendedEtfSchema` (e.g., "S&P 500", "FTSE All-World"). Lets downstream stages group ETFs tracking the same index. Free text is sufficient — the plan stage LLM can handle minor naming variations
- **Models**: `gpt-5.4-nano` for Phase A (allocation — no tools needed) and Phase C (extraction), `gpt-5.4-mini` for Phase B (research + web search — nano doesn't support web search)
- **Reasoning effort**: `low` for all three phases — improves query planning and extraction quality without significant latency cost. `medium` on research caused timeouts (120s+)
- **Built-in web search over Tavily** — OpenAI's `{ type: "web_search" }` tool. Model decides when and what to search. Eliminates Tavily client, mock, error class, and custom search tool handler. Trade-off: less control (black box). If quality is insufficient, Tavily is the documented fallback
- **Domain-restricted search**: `filters.allowed_domains` restricts web search to curated Israeli finance sites: `lazyinvestor.co.il`, `hasolidit.com`, `moneyplan.co.il`, `tase.co.il`. Unrestricted search produced generic results from international sites; domain filtering combined with prompt guidance yields Israel-specific ETF data with TASE numbers
- **`user_location`**: Hardcoded to `IL` (Israel) on the `WEB_SEARCH_TOOL` definition for MVP. Country code mapping from `profile.location` deferred until global support is needed
- **No tool loop**: Unlike clarify's `ask_user` loop, `web_search` is handled internally by OpenAI. One `callOpenAI` call, no loop
- **No `emitEvent` yet**: `search_progress` events deferred to Section 7 (WebSocket layer). Keeps function signature simple
- **`expenseRatio` as `z.coerce.number().positive()`**: coerced from string to number at the schema level. Originally planned as string — changed during 4.4 evals for cleaner validation
- **`ticker` max length 10**: supports both standard tickers (e.g., "VWRA") and TASE numbers (e.g., "1159250")
- **`sourceUrl` as `z.string().min(1)`**: OpenAI structured outputs don't support `"format": "uri"` in JSON Schema, so `z.string().url()` was dropped
- **No `SearchFailedError` hard gate** — validate that the `ResearchSummary` output contains substantive content (`.min(1)` on ETF array, `.min(1)` on all string fields). Empty/low-quality output is a Zod validation failure
- **Citation annotations**: Phase B response includes `url_citation` annotations with `url` and `title` on the message text. Phase C extracts these into the `sourceUrl` field via `previous_response_id` chaining

### Stage Flow

Three phases (allocation → ETF search → extraction):

1. `buildAllocationPlan(profile)` → `AllocationPlan` (nano, no web search)
2. `callOpenAI` + web_search → research text (guided by allocation plan)
3. `extractResearchSummary` → `ResearchSummary` (extraction)

### New Files

- `src/server/pipeline/data/brokerages.ts` — hardcoded brokerage table
- `src/server/pipeline/data/index.ts` — barrel export
- `src/server/pipeline/lib/build-profile-summary.ts` — shared `buildProfileSummary(profile)` utility (pipeline-level, used across stages)
- `src/server/pipeline/lib/build-allocation-summary.ts` — formats `AllocationPlan` as text for research prompt
- `src/server/pipeline/lib/index.ts` — barrel export
- `src/server/pipeline/stages/research/research.stage.ts` — stage implementation
- `src/server/pipeline/stages/research/index.ts` — barrel export

### Schema Shapes

**`AllocationPlanSchema`**: `{ slices: AllocationSlice[], rationale: string }` — each slice has a category (e.g., "US Large Cap", "Israeli Bonds") and a percentage. Slices must sum to 100%.

**`RecommendedEtfSchema`**: `{ ticker, name, trackingIndex, expenseRatio, reasoning, risks, sourceUrl }` — `ticker` max 10 chars (supports TASE numbers), `expenseRatio` as `z.coerce.number().positive()`, `sourceUrl` as `z.string().min(1)` (OpenAI structured outputs don't support URI format), `trackingIndex` as free text (e.g., "S&P 500").

**`ResearchSummarySchema`**: `{ recommendedEtfs: RecommendedEtf[] }` only — brokerage and allocation are separate concerns.

**`ResearchStageResult`**: `{ allocationPlan: AllocationPlan, researchSummary: ResearchSummary }`.

---

### Task 4.1 — `investmentPreferences` on `UserProfileSchema` + clarify prompt update

**Files modified:**
- `src/server/schemas/pipeline.schema.ts` — add `investmentPreferences` field (required, free text, defaults to `"none"`)
- `src/server/pipeline/stages/clarify/clarify.stage.ts` — update clarify prompt to ask about sectors, markets, specific instruments

**Why first**: allocation LLM uses `investmentPreferences` to create category-specific slices — this field must exist on the profile before implementing the research stage.

### Task 4.2 — Schemas, types, and web_search tool registration

**Files modified:**
- `src/server/schemas/pipeline.schema.ts` — add `RecommendedEtfSchema` (with `trackingIndex`), `ResearchSummarySchema`, `AllocationPlanSchema`
- `src/server/types/pipeline.types.ts` — add `ResearchSummary`, `AllocationPlan`, `AllocationSlice`, `ResearchStageResult` types
- `src/server/pipeline/tools/index.ts` — add `WEB_SEARCH_TOOL` with `user_location` (IL), `search_context_size`, and `filters.allowed_domains` restricting to Israeli finance sites

### Task 4.3 — Hardcoded brokerage table + `buildAllocationSummary`

**Files created:**
- `src/server/pipeline/data/brokerages.ts` — static `ISRAELI_BROKERAGES` constant (4 brokers: Meitav, IBI, Psagot, Excellence). No Interactive Brokers — tax reporting complexity doesn't fit a "lazy" product. Data sourced from lazyinvestor.co.il
- `src/server/pipeline/data/index.ts` — barrel export
- `src/server/pipeline/lib/build-profile-summary.ts` — shared `buildProfileSummary(profile)` utility
- `src/server/pipeline/lib/build-allocation-summary.ts` — formats `AllocationPlan` as text for research prompt context
- `src/server/pipeline/lib/index.ts` — barrel export

### Task 4.4 — Research stage implementation (three-phase) with prompts

**Files created:**
- `src/server/pipeline/stages/research/research.stage.ts` — stage implementation
- `src/server/pipeline/stages/research/index.ts` — barrel export

**`runResearchStage(profile: UserProfile): Promise<ResearchStageResult>`**:
1. Build profile summary via `buildProfileSummary`
2. **Phase A**: `buildAllocationPlan(profile)` — `callOpenAIParsed<AllocationPlan>` with `gpt-5.4-nano`, low reasoning, no web search. Considers emergency fund + age interaction, `investmentPreferences` for category slices, קרן כספית as bond alternative
3. **Phase B**: `callOpenAI` with `gpt-5.4-mini`, web_search tool, research prompt guided by allocation plan. Domain-restricted to Israeli finance sites. Searches for ETFs + קרנות כספיות matching allocation slices
4. **Phase C**: `extractResearchSummary` — `callOpenAIParsed<ResearchSummary>` with `gpt-5.4-nano`, extraction prompt, chained via `previous_response_id`. Extracts `trackingIndex`, structured ETF data
5. Return `{ allocationPlan, researchSummary }`

**Prompts:**
- **Allocation prompt**: target allocation from user profile, emergency fund + age interaction, investment preferences → category-specific slices
- **Research prompt**: role is financial researcher (not advisor), sources restricted to Israeli finance sites, searches for ETFs + קרנות כספיות matching each allocation slice, flowing paragraphs output
- **Extraction prompt**: extract structured `ResearchSummary` from research text, field rules for `trackingIndex`/`ticker`/`expenseRatio`/`sourceUrl`, stay close to research text

**Reuse from existing code:**
- `callOpenAI`, `callOpenAIParsed` from `#server/services/openai`
- `getStageTools` from `#server/pipeline/tools`
- `buildProfileSummary`, `buildAllocationSummary` from `#server/pipeline/lib`
- `createLogger` from `#server/lib/logger`
- `zodTextFormat` from `openai/helpers/zod`
- `ResearchSummarySchema`, `AllocationPlanSchema` from `#server/schemas/pipeline.schema`

### Task 4.5 — Research stage unit tests

**File created:**
- `src/server/pipeline/stages/research/research.stage.test.ts`

**Mock pattern** (same as clarify tests — `vi.hoisted` + `vi.mock`):
```typescript
const { mockedCallOpenAI, mockedCallOpenAIParsed } = vi.hoisted(() => ({
  mockedCallOpenAI: vi.fn(),
  mockedCallOpenAIParsed: vi.fn(),
}));

vi.mock("#server/services/openai", () => ({
  callOpenAI: mockedCallOpenAI,
  callOpenAIParsed: mockedCallOpenAIParsed,
}));
```

**Mock data:**
- `mockProfile: UserProfile` — realistic Israeli investor (includes `investmentPreferences`)
- `mockAllocationPlan: AllocationPlan` — realistic allocation slices summing to 100%
- `mockResearchSummary: ResearchSummary` — realistic ETF entries with `trackingIndex`, TASE tickers
- `createResearchResponse()` — returns `OpenAIResponse<ResponseOutputItem[]>` with a message item
- Uses shared `mockTokenUsage` from `#server/mocks/openai.service.mock`

**Test scenarios** (behavior-only — no implementation detail assertions like verifying call arguments):
1. **Happy path** — returns `ResearchStageResult` with both `allocationPlan` and `researchSummary`
2. **Propagates allocation error** (Phase A) — `ServiceUnavailableError`; research phase not called
3. **Propagates research error** (Phase B) — `ServiceUnavailableError`; extraction phase not called
4. **Propagates extraction error** (Phase C) — `InternalError`

### Task 4.6 — Research stage evals

**Prerequisite**: `extractResearchSummary` and `buildAllocationPlan` are exported for direct eval usage. `extractResearchSummary` accepts `ExtractionParams` with `input` and optional `previousResponseId` — supports both production (response chaining) and eval (deterministic input) usage.

**File created:**
- `src/server/pipeline/stages/research/research.stage.eval.ts`

**Eval structure — two layers** (mirrors clarify eval structure):

**Layer 1: Extraction-only evals**
- Feed handwritten research text directly to `extractResearchSummary`
- Deterministic input — only model extraction variance affects output
- Stories include `trackingIndex` data and no brokerage paragraphs (brokerage is hardcoded, not extracted)
- Tight assertions: exact tickers, expense ratios, ETF count, trackingIndex values

**Layer 1b: Allocation evals**
- Feed various `UserProfile` inputs to `buildAllocationPlan`
- Tests: emergency fund impact on bond allocation, investment preferences driving category slices, age-dependent bond requirements
- Tight assertions: slices sum to 100%, expected categories present

**Layer 2: Full-loop eval**
- Run `runResearchStage` with a real profile against live OpenAI + web search
- Returns `ResearchStageResult = { allocationPlan, researchSummary }`
- Allocation assertions: slices sum to 100%, categories match preferences
- ETF assertions: schema validation (expenseRatio coerced to positive number, trackingIndex present, sourceUrl non-empty)

### Task 4.7 — Doc updates

Update STATUS.md, PLAN_SECTION_4.md, and TESTING.md to reflect completed implementation, schema decisions discovered during evals, and research-specific eval guidance.
