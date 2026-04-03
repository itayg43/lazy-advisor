# Project Status

## Completed

### Section 1: Project Setup
- [x] 1.1 — package.json + tsconfig.json
- [x] 1.2 — Vitest setup
- [x] 1.3 — Folder skeleton + placeholder entry points
- [x] 1.4 — Docker Compose + env config
- [x] 1.5 — Config module
- [ ] 1.6 — Event types (deferred — will be implemented in Section 7 with WebSocket events)
- [x] 1.7 — withRetry utility (8 tests passing)
- [x] 1.8 — ESLint + Prettier (`tseslint.configs.strict`, `padding-line-between-statements` for return/throw)

### CI & Branch Protection
- [x] GitHub Actions CI pipeline
- [x] Branch protection ruleset
- [x] `format:check` script

### Section 2: Database Layer
- [x] 2.0a — Path aliases via Node.js subpath imports
- [x] 2.1 — Prisma schema
- [x] 2.2 — Domain types
- [x] 2.3 — Plan repository + Prisma client
- [x] 2.4 — Step repository
- [x] 2.5 — Plan service + error classes
- [x] 2.6 — Step service
- [x] 2.7 — Repository + service tests (18 passing: 7 unit, 11 integration)

### Infrastructure (during 2.7)
- [x] Prisma 7 migration
- [x] Prisma client PrismaPg driver adapter
- [x] Separate Vitest config for repository tests
- [x] `test:repositories` script
- [x] Separate test database

### Section 3: Stage 1 — Clarify
- [x] 3.1 — UserProfileSchema Zod schema
- [x] 3.2 — OpenAI client singleton + service (9 tests passing)
- [x] 3.3 — OpenAI service mock data (inline in test files)
- [x] 3.4 — `ask_user` tool
- [x] 3.4b — Logger utility (`createLogger`)
- [x] 3.5 — Tool registry
- [x] 3.6 — Clarify stage
- [x] 3.7 — Clarify stage unit tests (6 passing)
- [x] 3.7b — Clarify stage evals (10 passing: 5 extraction-only + 5 full-loop)

### Code Review Fixes (Sections 1-3)
- [x] Hardened error handling, schemas, imports, tests, and ESLint config

### Clarify Stage Refactor
- [x] Extracted `clarify.constants.ts` — `RISK_LEVELS`, `KNOWLEDGE_LEVELS`, `MAX_STAGE_TOOL_CALLS`
- [x] Removed duplicated level derivations from `clarify.stage.ts` and `clarify.extraction.ts`
- [x] Use `ASK_USER_TOOL.name` constant instead of hardcoded `"ask_user"` string
- [x] Typed `toolOutputs` array explicitly as `ResponseInputItem.FunctionCallOutput[]`
- [x] Moved `MAX_STAGE_TOOL_CALLS` export to `clarify.constants.ts`

### Section 4: Stage 2 — Research
- [x] 4.1 — `investmentPreferences` on `UserProfileSchema` + clarify prompt update (2 new evals: extraction + full-loop)

## Up Next

Section 4 continued (4.2–4.7). See [PLAN_SECTION_4.md](plan/plan-sections/PLAN_SECTION_4.md) for task details.
