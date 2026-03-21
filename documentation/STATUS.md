# Project Status

## Completed

### Section 1: Project Setup
- [x] 1.1 — package.json + tsconfig.json (strict, ES2022, ESNext, bundler module resolution)
- [x] 1.2 — Vitest setup
- [x] 1.3 — Folder skeleton + placeholder entry points
- [x] 1.4 — Docker Compose (Postgres 16 + Redis 7), .env.example, .env, .gitignore
- [x] 1.5 — Config module (dotenv + envalid)
- [x] 1.6 — Shared constants + event types (discriminated unions)
- [x] 1.7 — withRetry utility + tests (4 passing)
- [x] 1.8 — ESLint flat config (strict type-checked) + Prettier

### CI & Branch Protection
- [x] GitHub Actions CI pipeline (lint, format check, type-check, tests) on PRs to main
- [x] Branch protection ruleset: PRs required, CI must pass, branch must be up to date
- [x] `format:check` script added to package.json

## Notes

- Server will be Dockerized in Section 7 (Task 7.1b) — Dockerfile.dev, develop.watch, tsx hot reload inside container

### Section 2: Database Layer (Prerequisite)
- [x] 2.0a — Path aliases (`#shared/*`, `#server/*`) via Node.js subpath imports

### Section 2: Database Layer
- [x] 2.1 — Prisma schema (Plan + Step models, PlanStatus enum, cascade delete, prisma.config.ts)
- [x] 2.2 — Domain types (re-exported from Prisma client, PlanWithSteps via PlanGetPayload, PlanStatus as value export)
- [x] 2.3 — Plan repository (createPlan, getPlanWithSteps, updatePlan), Prisma client with PrismaPg adapter, UpdatePlanParams type
- [x] 2.4 — Step repository (createStep, updateStep, removeStep), CreateStepParams + UpdateStepParams types
- [x] 2.5 — Plan service (createPlan, getPlanWithSteps, updatePlan), error classes (BaseError, NotFoundError, etc.)
- [x] 2.6 — Step service (createStep, updateStep, removeStep), wrapping step repository
- [x] 2.7 — Repository + service tests (22 passing: 11 unit, 11 integration)

### Infrastructure (during 2.7)
- [x] Prisma 7 migration: `prisma.config.ts` moved to project root, added `dotenv/config` import
- [x] Prisma client updated to use `PrismaPg` driver adapter (`@prisma/adapter-pg`)
- [x] Separate Vitest config for repository tests (`vitest.config.repositories.ts`, `fileParallelism: false`)
- [x] `test:repositories` script: resets test DB (`prisma db push --force-reset`) then runs repo tests, using `dotenv-cli` to load `.env.test`
- [x] Separate test database (`lazy_advisor_test`), configured via `.env.test` (`.env.test.example` provided)

## Up Next

### Section 3: Stage 1 — Clarify
