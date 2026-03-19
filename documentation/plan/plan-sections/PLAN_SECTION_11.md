## Section 11: Integration Testing + Polish

**Goal**: End-to-end tests, error handling verification, disclaimer, README.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 11.1 | E2E happy path test (connect → clarify → research → plan → done, verify DB) | `src/server/pipeline/orchestrator/orchestrator.integration.test.ts` | All |
| 11.2 | E2E iteration test (adjust flow, verify DB updates) | `src/server/pipeline/orchestrator/orchestrator.integration.test.ts` | 11.1 |
| 11.3 | E2E research_and_adjust test (re-research, new plan) | `src/server/pipeline/orchestrator/orchestrator.integration.test.ts` | 11.1 |
| 11.4 | Error handling tests (OpenAI failure at each stage, Zod validation failure) | `src/server/pipeline/orchestrator/orchestrator.integration.test.ts` | 11.1 |
| 11.5 | Disclaimer display (CLI startup + first WS event) | `src/cli/cli.ts`, `src/server/ws/handler/handler.ts` | 8.6, 7.2 |
| 11.6 | README (architecture, setup, run, test) | `README.md` | All |
| 11.7 | Manual QA pass with real OpenAI + Tavily keys | Various | All |

**Runnable after**: Complete project, all tests pass
