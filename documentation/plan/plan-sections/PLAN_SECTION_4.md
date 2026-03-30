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
- **`user_location`**: Derived from `profile.location` via a country code map (e.g., "Israel" → `{ type: "approximate", country: "IL" }`), passed to the web_search tool for regional search relevance. If no mapping exists, omit `user_location`
- **No tool loop**: Unlike clarify's `ask_user` loop, `web_search` is handled internally by OpenAI. One `callOpenAI` call, no loop
- **No `emitEvent` yet**: `search_progress` events deferred to Section 7 (WebSocket layer). Keeps function signature simple
- **`expenseRatio` as string without `%`**: e.g., `"0.22"` not `"0.22%"`. Trivially parseable to float, no symbol stripping
- **No `SearchFailedError` hard gate** — validate that the `ResearchSummary` output contains substantive content (`.min(1)` on ETF array, `.min(1)` on all string fields). Empty/low-quality output is a Zod validation failure
- **Citation annotations**: Phase A response includes `url_citation` annotations with `url` and `title` on the message text. Phase B extracts these into the `sourceUrl` field via `previous_response_id` chaining

### Task 4.1 — ResearchSummary schema + web_search tool registration

**Status**: Complete

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
export const WEB_SEARCH_TOOL: WebSearchTool = {
  type: "web_search",
  search_context_size: "medium",
};
```
Exported so the research stage can merge `user_location` at call time.

### Task 4.2 — Research stage implementation

**Files to create:**
- `src/server/pipeline/stages/research/research.stage.ts`
- `src/server/pipeline/stages/research/index.ts` (barrel export)

**Country code mapping** (lives in `research.stage.ts`):
```typescript
const LOCATION_TO_COUNTRY_CODE: Record<string, string> = {
  israel: "IL",
  "united states": "US",
  usa: "US",
  "united kingdom": "GB",
  uk: "GB",
  germany: "DE",
  canada: "CA",
  australia: "AU",
  france: "FR",
};

const getCountryCode = (location: string): string | undefined =>
  LOCATION_TO_COUNTRY_CODE[location.toLowerCase()];
```

**`buildWebSearchTool(location)`**: Takes profile location, looks up country code. If found, spreads `WEB_SEARCH_TOOL` with `user_location: { type: "approximate", country }`. If not found, returns base `WEB_SEARCH_TOOL` unchanged.

**`buildProfileSummary(profile)`**: Formats all UserProfile fields as a readable text string for the model input.

**`RESEARCH_SYSTEM_PROMPT`** — covers:
- Role: financial researcher (not advisor) — gather data, don't create plans
- Instructions: search 2-3 diverse queries, prefer authoritative sources, current year data
- What to research: ETFs (expense ratios, domicile, accumulating vs distributing), brokerages (skip if user has one), allocation strategies, tax efficiency
- Location-specific guidance:
  - Israeli investors: Irish accumulating ETFs (15% vs 25% withholding), קרנות מחקות, Meitav/IBI
  - US investors: commission-free brokerages, tax-loss harvesting, IRA implications
  - Others: local brokerages, tax treaty advantages
- Output: flowing paragraphs (no markdown headers), covering each ETF with ticker/name/ER/reasoning/risks/source URL, brokerage recommendation, allocation rationale with percentages

**`EXTRACTION_SYSTEM_PROMPT`** — covers:
- Role: extract structured ResearchSummary from preceding research
- Field rules:
  - `expenseRatio`: number-only string, no `%` (e.g., `"0.22"`)
  - `sourceUrl`: real URL from research — do not fabricate
- Stay close to research text, don't add information not found

**`runResearchStage(profile: UserProfile): Promise<ResearchSummary>`**:
1. Build web search tool with `user_location` from profile
2. Replace base web_search tool in stage tools with location-aware version
3. Build profile summary string
4. **Phase A**: `callOpenAI({ model: RESEARCH_MODEL, instructions: RESEARCH_SYSTEM_PROMPT, input: profileSummary, tools })`
5. Log response ID and usage
6. **Phase B**: `callOpenAIParsed<ResearchSummary>({ model: EXTRACTION_MODEL, instructions: EXTRACTION_SYSTEM_PROMPT, input: [], previous_response_id: researchResponse.id, text: { format: zodTextFormat(ResearchSummarySchema, "ResearchSummarySchema") } })`
7. Log extraction response ID, usage, and ETF count
8. Return `extractionResponse.output`

**Reuse from existing code:**
- `callOpenAI`, `callOpenAIParsed` from `#server/services/openai`
- `getStageTools`, `WEB_SEARCH_TOOL` from `#server/pipeline/tools`
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

**Test scenarios:**
1. **Happy path** — returns extracted ResearchSummary; `callOpenAI` called once, `callOpenAIParsed` called once with `previous_response_id` from Phase A
2. **Propagates callOpenAI error** (research phase) — `ServiceUnavailableError`; `callOpenAIParsed` not called
3. **Propagates callOpenAIParsed error** (extraction phase) — `InternalError`

### Task 4.4 — Research stage evals

**File to create:**
- `src/server/pipeline/stages/research/research.stage.eval.ts`

**Eval approach:**
- Real API calls with web search — loose assertions only (results change daily)
- 2-3 test profiles: Israeli beginner moderate risk, Israeli aggressive young investor
- Call `runResearchStage` with real profile
- Assertions per result:
  - `recommendedEtfs.length >= 1`
  - Each ETF: non-empty `ticker`, `name`, `reasoning`, `risks`
  - Each ETF: `sourceUrl` is valid URL format
  - Each ETF: `expenseRatio` matches `/^\d+(\.\d+)?$/` (numeric string, no `%`)
  - `brokerageRecommendation` and `allocationRationale` are non-empty
- Timeout: 60s per test (web search is slow)

**Runnable after**: Research stage works in isolation, produces validated ResearchSummary
