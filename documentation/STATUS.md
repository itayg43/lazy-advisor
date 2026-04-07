# Project Status

> **When closing a task, update all three:** (1) the relevant task entry in Completed below, (2) Up Next, (3) the relevant plan section in `documentation/plan/plan-sections/`.

## Up Next

**Next task: 4.4b — Phase C: extraction function + evals.**
Tasks 4.4b, 4.4c, 4.4d, 4.7 remaining in Section 4. See [PLAN_SECTION_4.md](plan/plan-sections/PLAN_SECTION_4.md) for full task details.

## Completed

### Section 1: Project Setup
- [x] 1.1 — package.json + tsconfig.json
- [x] 1.2 — Vitest setup
- [x] 1.3 — Folder skeleton + placeholder entry points
- [x] 1.4 — Docker Compose + env config
- [x] 1.5 — Config module
- [ ] 1.6 — Event types (deferred — will be implemented in Section 7 with WebSocket events)
- [x] 1.7 — withRetry utility
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
- [x] 2.7 — Repository + service tests

### Infrastructure (during 2.7)
- [x] Prisma 7 migration
- [x] Prisma client PrismaPg driver adapter
- [x] Separate Vitest config for repository tests
- [x] `test:repositories` script
- [x] Separate test database

### Section 3: Stage 1 — Clarify
- [x] 3.1 — UserProfileSchema Zod schema
- [x] 3.2 — OpenAI client singleton + service
- [x] 3.3 — OpenAI service mock data (inline in test files)
- [x] 3.4 — `ask_user` tool
- [x] 3.4b — Logger utility (`createLogger`)
- [x] 3.5 — Tool registry
- [x] 3.6 — Clarify stage
- [x] 3.7 — Clarify stage unit tests
- [x] 3.7b — Clarify stage evals

### Code Review Fixes (Sections 1–3)
- [x] Hardened error handling, schemas, imports, tests, and ESLint config

### Clarify Stage Refactor
- [x] Extracted `clarify.constants.ts` — `RISK_LEVELS`, `KNOWLEDGE_LEVELS`, `MAX_STAGE_TOOL_CALLS`
- [x] Removed duplicated level derivations from `clarify.stage.ts` and `clarify.extraction.ts`
- [x] Use `ASK_USER_TOOL.name` constant instead of hardcoded `"ask_user"` string
- [x] Typed `toolOutputs` array explicitly as `ResponseInputItem.FunctionCallOutput[]`
- [x] Moved `MAX_STAGE_TOOL_CALLS` export to `clarify.constants.ts`

### Clarify Stage — Investment Preferences Weighting
- [x] Clarify prompt updated to ask for a percentage split when user names multiple instruments (e.g. "70% S&P 500, 30% TLV-125")
- [x] Extraction prompt updated to capture percentage splits in `investmentPreferences`
- [x] Stage and extraction evals updated to cover the split-request flow
- [x] `WORKFLOW_EXAMPLES.md` Story 12 and `PLAN_SECTION_4.md` updated to document the decision

### Section 4: Stage 2 — Research
- [x] 4.1 — `investmentPreferences` on `UserProfileSchema` + clarify prompt update
- [x] 4.2 — Research stage schemas, types, and web search tool registration
- [x] 4.3 — Hardcoded brokerage table + shared utilities
- [x] 4.4a — `buildAllocationPlan` in `research.allocation.ts` + allocation evals

### Section 12: Eval Infrastructure
- [x] 12.1 — Eval run history: custom Vitest reporter writing `.runs.jsonl` per eval file

### Security Improvements
- [x] Replaced `dotenv` + `dotenv-cli` with `dotenvx` — `.env` and `.env.test` encrypted in place, ciphertext committed, `.env.keys` gitignored
- [x] Removed `import "dotenv/config"` from `config.ts` and `prisma.config.ts` — env injection handled by `dotenvx run` in npm scripts
- [x] Added `secretlint` pre-commit hook via `husky` + `lint-staged` — blocks raw API key patterns from being committed
- [x] Added prisma convenience scripts (`prisma:migrate`, `prisma:studio`, `prisma:push`) to ensure dotenvx wrapping on direct CLI calls

## Workflow Improvements

Based on "Everything We Got Wrong About Research-Plan-Implement" by Dexter Horthy. See [RPI_IMPROVEMENTS.md](RPI_IMPROVEMENTS.md) for full analysis.

- [x] Gap 1 — Objective research: Explore subagent with no task framing before designing (added to `CLAUDE.md`)
- [ ] Gap 2 — Design artifact before implementation (pending discussion)
- [ ] Gap 3 — Vertical slices in task planning (pending discussion)
