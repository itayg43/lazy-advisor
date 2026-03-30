## Section 4: Stage 2 — Research

**Goal**: Given UserProfile, uses OpenAI's built-in web search to gather current financial data, produces validated ResearchSummary.

### Stage Contract

- **Input**: `UserProfile` from Stage 1
- **Output**: `ResearchSummary` — validated via Zod schema (see 4.1 for schema definition)
- **Tools**: OpenAI built-in `web_search` with `user_location` derived from the user's profile
- **Key**: Raw search results are summarized and compressed here. Stage 3 never sees the raw HTML/text — only the structured summary

### Design Decisions

- **Two-phase structure** (mirrors clarify): Phase A calls `callOpenAI` with `web_search` tool — model searches autonomously and writes a flowing synthesis. Phase B calls `callOpenAIParsed<ResearchSummary>` chained via `previous_response_id` to extract structured data. Keeps search and extraction concerns separated
- **Models**: `gpt-5.4-mini` for Phase A (research + web search — nano doesn't support web search), `gpt-5.4-nano` for Phase B (extraction only, same as clarify)
- **Built-in web search over Tavily** — OpenAI's `{ type: "web_search" }` tool. Model decides when and what to search. Eliminates Tavily client, mock, error class, and custom search tool handler. Trade-off: less control (black box). If quality is insufficient, Tavily is the documented fallback
- **`user_location`**: Hardcoded to `IL` (Israel) on the `WEB_SEARCH_TOOL` definition for MVP. Country code mapping from `profile.location` deferred until global support is needed
- **No tool loop**: Unlike clarify's `ask_user` loop, `web_search` is handled internally by OpenAI. One `callOpenAI` call, no loop
- **No `emitEvent` yet**: `search_progress` events deferred to Section 7 (WebSocket layer). Keeps function signature simple
- **`expenseRatio` as string without `%`**: e.g., `"0.22"` not `"0.22%"`. Trivially parseable to float, no symbol stripping
- **No `SearchFailedError` hard gate** — validate that the `ResearchSummary` output contains substantive content (`.min(1)` on ETF array, `.min(1)` on all string fields). Empty/low-quality output is a Zod validation failure
- **Citation annotations**: Phase A response includes `url_citation` annotations with `url` and `title` on the message text. Phase B extracts these into the `sourceUrl` field via `previous_response_id` chaining

### Task 4.1 — ResearchSummary schema + web_search tool registration

**Files modified:**
- `src/server/schemas/pipeline.schema.ts` — added `RecommendedEtfSchema` and `ResearchSummarySchema`
- `src/server/types/pipeline.types.ts` — added `ResearchSummary` type
- `src/server/pipeline/tools/index.ts` — added `WEB_SEARCH_TOOL` to `research` and `iterate` stages

**ResearchSummary schema:**
```typescript
const MAX_LONG_STRING_LENGTH = 1024;
const MAX_ETF_RECOMMENDATIONS = 10;

const RecommendedEtfSchema = z.object({
  ticker: z.string().min(1).max(5),
  name: z.string().min(1).max(MAX_STRING_LENGTH),        // "Vanguard FTSE All-World UCITS ETF"
  expenseRatio: z.string().min(1).max(16),                // "0.22" — no % suffix
  reasoning: z.string().min(1).max(MAX_LONG_STRING_LENGTH),
  risks: z.string().min(1).max(MAX_LONG_STRING_LENGTH),
  sourceUrl: z.string().url(),
});

export const ResearchSummarySchema = z.object({
  recommendedEtfs: z.array(RecommendedEtfSchema).min(1).max(MAX_ETF_RECOMMENDATIONS),
  brokerageRecommendation: z.string().min(1).max(MAX_LONG_STRING_LENGTH),
  allocationRationale: z.string().min(1).max(MAX_LONG_STRING_LENGTH),
});
```

**Web search tool** (`tools/index.ts`):
```typescript
const DEFAULT_COUNTRY_CODE = "IL";

const WEB_SEARCH_TOOL: WebSearchTool = {
  type: "web_search",
  search_context_size: "medium",
  user_location: { type: "approximate", country: DEFAULT_COUNTRY_CODE },
};
```
Location is baked into the tool definition (MVP: Israel-only). Stages access it via `getStageTools`.

### Task 4.2 — Research stage implementation

**Files created:**
- `src/server/pipeline/stages/research/research.stage.ts`
- `src/server/pipeline/stages/research/index.ts` (barrel export)
- `src/server/pipeline/lib/build-profile-summary.ts` — shared `buildProfileSummary(profile)` utility (pipeline-level, used across stages)
- `src/server/pipeline/lib/index.ts` (barrel export)

**Files modified:**
- `src/server/pipeline/tools/index.ts` — `WEB_SEARCH_TOOL` now includes `user_location` with `DEFAULT_COUNTRY_CODE = "IL"` (MVP: Israel-only). Country code mapping deferred until global support is needed.

**`buildProfileSummary(profile)`**: Formats all UserProfile fields as a readable text string for model input. Lives in `pipeline/lib/` since multiple stages will use it.

**`RESEARCH_SYSTEM_PROMPT`** — covers:
- Role: financial researcher (not advisor) — gather data, don't create plans
- Instructions: search 2–3 diverse queries, prefer authoritative sources, current year data
- What to research: ETFs (expense ratios, domicile, accumulating vs distributing), brokerages (skip if user has one), allocation strategies, tax efficiency
- Location-specific guidance for Israel: Irish accumulating ETFs (15% vs 25% withholding), קרנות מחקות, Meitav/IBI
- Output: flowing paragraphs (no markdown headers), covering each ETF with ticker/name/ER/reasoning/risks/source URL, brokerage recommendation, allocation rationale with percentages

**`EXTRACTION_SYSTEM_PROMPT`** — covers:
- Role: extract structured ResearchSummary from preceding research
- Field rules: `expenseRatio` as number-only string (no `%`), `sourceUrl` must be real URL from research
- Stay close to research text, don't add information not found

**`runResearchStage(profile: UserProfile): Promise<ResearchSummary>`**:
1. Get tools via `getStageTools("research")` (includes location-aware web_search)
2. Build profile summary string via `buildProfileSummary`
3. **Phase A**: `callOpenAI` with `gpt-5.4-mini`, research prompt, profile summary as input
4. **Phase B**: `callOpenAIParsed<ResearchSummary>` with `gpt-5.4-nano`, extraction prompt, chained via `previous_response_id`
5. Return `extractionResponse.output`

**Reuse from existing code:**
- `callOpenAI`, `callOpenAIParsed` from `#server/services/openai`
- `getStageTools` from `#server/pipeline/tools`
- `buildProfileSummary` from `#server/pipeline/lib`
- `createLogger` from `#server/lib/logger`
- `zodTextFormat` from `openai/helpers/zod`
- `ResearchSummarySchema` from `#server/schemas/pipeline.schema`

### Task 4.3 — Research stage unit tests

**File to create:**
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
- `mockProfile: UserProfile` — realistic Israeli investor (reuse field pattern from clarify tests)
- `mockResearchSummary: ResearchSummary` — realistic ETF entries (VWRA, AGGU)
- `createResearchResponse()` — returns `OpenAIResponse<ResponseOutputItem[]>` with a message item
- Uses shared `mockTokenUsage` from `#server/mocks/openai.service.mock`

**Test scenarios** (behavior-only — no implementation detail assertions like verifying call arguments):
1. **Happy path** — returns extracted ResearchSummary
2. **Propagates callOpenAI error** (research phase) — `ServiceUnavailableError`; `callOpenAIParsed` not called
3. **Propagates callOpenAIParsed error** (extraction phase) — `InternalError`

### Task 4.4 — Research stage evals

**Prerequisite**: Extract extraction logic into a standalone exported `extractResearchSummary` function (mirrors clarify's `extractUserProfile`). This enables extraction-only evals with deterministic input.

**File to create:**
- `src/server/pipeline/stages/research/research.stage.eval.ts`

**Eval approach — two layers** (mirrors clarify eval structure):

**Layer 1: Full-loop eval (build first)**
- Run `runResearchStage` with a real profile (Story 1: beginner, ₪55k, moderate, Israel) against live OpenAI + web search
- Purpose: observe what realistic research output looks like, then use that to inform handwritten research text for extraction-only evals
- Loose assertions only (results change daily):
  - `recommendedEtfs.length >= 1`
  - Each ETF: non-empty `ticker`, `name`, `reasoning`, `risks`
  - Each ETF: `sourceUrl` is valid URL format
  - Each ETF: `expenseRatio` matches `/^\d+(\.\d+)?$/` (numeric string, no `%`)
  - `brokerageRecommendation` and `allocationRationale` are non-empty
- Timeout: 60s per test (web search is slow)

**Layer 2: Extraction-only evals (build after observing full-loop output)**
- Feed handwritten research text (modeled after real full-loop output) directly to `extractResearchSummary`
- Deterministic input — only model extraction variance affects the output
- Tighter assertions on extracted fields (ticker values, expense ratios, ETF count)
- Multiple stories covering different profiles and research scenarios

**Runnable after**: Research stage works in isolation, produces validated ResearchSummary
