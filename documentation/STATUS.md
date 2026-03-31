# Project Status

## Completed

### Section 1: Project Setup
- [x] 1.1 — package.json + tsconfig.json
- [x] 1.2 — Vitest setup
- [x] 1.3 — Folder skeleton + placeholder entry points
- [x] 1.4 — Docker Compose + env config
- [x] 1.5 — Config module
- [x] 1.6 — Event types
- [x] 1.7 — withRetry utility (8 tests passing)
- [x] 1.8 — ESLint + Prettier (`tseslint.configs.strict`, `padding-line-between-statements` for return/throw)

### CI & Branch Protection
- [x] GitHub Actions CI pipeline
- [x] Branch protection ruleset
- [x] `format:check` script

## Notes

- Server will be Dockerized in Section 7 (Task 7.1b)

### Section 2: Database Layer (Prerequisite)
- [x] 2.0a — Path aliases via Node.js subpath imports

### Section 2: Database Layer
- [x] 2.1 — Prisma schema
- [x] 2.2 — Domain types
- [x] 2.3 — Plan repository + Prisma client
- [x] 2.4 — Step repository
- [x] 2.5 — Plan service + error classes
- [x] 2.6 — Step service
- [x] 2.7 — Repository + service tests (22 passing: 11 unit, 11 integration)

### Infrastructure (during 2.7)
- [x] Prisma 7 migration
- [x] Prisma client PrismaPg driver adapter
- [x] Separate Vitest config for repository tests
- [x] `test:repositories` script
- [x] Separate test database

## Up Next

### Section 3: Stage 1 — Clarify
- [x] 3.1 — UserProfileSchema Zod schema
- [x] 3.2 — OpenAI client singleton + service (9 tests passing)
- [x] 3.3 — OpenAI service mock data (inline in test files)
- [x] 3.4 — `ask_user` tool
- [x] 3.4b — Logger utility (`createLogger`)
- [x] 3.5 — Tool registry
- [x] 3.6 — Clarify stage
- [x] 3.7 — Clarify stage unit tests (6 passing)
- [x] 3.7b — Clarify stage evals (7 passing: 4 extraction-only + 3 full-loop)

### Code Review Fixes (Sections 1-3)
- [x] Hardened error handling, schemas, imports, tests, and ESLint config

### Section 4: Stage 2 — Research
- [ ] 4.1 — `investmentPreferences` on `UserProfileSchema` (required, free text, default `"none"`); update clarify prompt to ask about it
- [ ] 4.2 — Schemas (`RecommendedEtfSchema` with `trackingIndex`, `ResearchSummarySchema`, `AllocationPlanSchema`), types (`ResearchStageResult`), and `web_search` tool registration
- [ ] 4.3 — Hardcoded brokerage table (4 Israeli brokers: Meitav, IBI, Psagot, Excellence) + `buildAllocationSummary` utility
- [ ] 4.4 — Research stage implementation (three-phase: allocation → ETF search → extraction) with prompts
- [ ] 4.5 — Research stage unit tests
- [ ] 4.6 — Research stage evals (extraction-only, allocation, and full-loop)
- [ ] 4.7 — Doc updates (STATUS.md, PLAN_SECTION_4.md, TESTING.md)
