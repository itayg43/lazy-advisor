# Project Status

## Completed

### Section 1: Project Setup
- [x] 1.1 — package.json + tsconfig.json
- [x] 1.2 — Vitest setup
- [x] 1.3 — Folder skeleton + placeholder entry points
- [x] 1.4 — Docker Compose + env config
- [x] 1.5 — Config module
- [x] 1.6 — Shared constants + event types
- [x] 1.7 — withRetry utility (4 tests passing)
- [x] 1.8 — ESLint + Prettier

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
- [x] 3.3 — OpenAI service mock helpers
- [x] 3.4 — `ask_user` tool
- [x] 3.4b — Logger utility (`createLogger`)
- [x] 3.5 — Tool registry
- [x] 3.6 — Clarify stage (bug fixes: added missing `input: []` to Phase C; fixed Phase B not passing `instructions` via `previous_response_id`; prompt optimization with Field Validation section and dynamic enums; switched to `gpt-5.4-mini` with `reasoning: { effort: "low" }`; stage cap now throws `InternalError`)
- [ ] 3.7 — Clarify stage unit tests (stage cap → InternalError done; remaining: detailed/minimal/contradictory input, extraction failure)
- [x] 3.7b — Clarify stage level 1 evals (Story 1 with timeline probe assertion; remaining stories to be added incrementally)
