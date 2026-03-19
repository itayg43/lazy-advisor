## Section 4: Stage 2 — Research

**Goal**: Given UserProfile, runs Tavily searches, produces validated ResearchSummary. Hard gate on search failure.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 4.1 | Tavily client wrapper: `searchWeb()` with retry, typed `SearchFailedError` | `src/server/clients/tavily.client.ts` | 1.8, 1.6 |
| 4.2 | Mock Tavily test helper | `src/server/mocks/tavily.mock.ts` | 4.1 |
| 4.3 | `search` tool: definition + handler. Calls Tavily, emits `search_progress` via callback | `src/server/pipeline/tools/search.tool.ts` | 4.1 |
| 4.4 | Register search tool in registry for `research` and `iterate` stages | `src/server/pipeline/tool-registry.ts` | 4.3, 3.5 |
| 4.5 | Research stage: system prompt, tool-calling loop, **hard gate on SearchFailedError**, Zod validation, search cap | `src/server/pipeline/stages/research/research.stage.ts` | 3.1, 3.2, 4.3 |
| 4.6 | Research stage tests (happy path, search failure hard gate, validation failure, search cap, source_url presence) | `src/server/pipeline/stages/research/research.stage.test.ts` | 3.3, 4.2, 4.5 |

**Runnable after**: Research stage works in isolation, hard gate provably enforced
