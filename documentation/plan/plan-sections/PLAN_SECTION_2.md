## Section 2: Database Layer

**Goal**: Prisma schema, migrations, CRUD repositories for plans and steps with tests against real Postgres.

### Prerequisite: Setup Refactor

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 2.0a | **Path aliases for subpath imports.** Add `#shared/*` and `#server/*` subpath imports in `package.json` `imports` field (`#shared/*` → `./src/shared/*`, `#server/*` → `./src/server/*`). Add matching `paths` entries in `tsconfig.json` so the TS compiler resolves them. Update `vitest.config.ts` `resolve.alias` so Vitest resolves them. Update the conventions doc imports section to document the aliases. Update any existing relative imports to use the aliases where appropriate | `package.json`, `tsconfig.json`, `vitest.config.ts`, `documentation/CONVENTIONS.md`, any files with cross-folder imports | — |

### Database

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 2.1 | Prisma schema: `Plan` + `Step` models with `Int` auto-increment IDs, `PlanStatus` enum (`draft` — just created, `active` — pipeline running, `completed` — finalized), `Step.description` as `@db.Text`, unique constraint on `(planId, sortOrder)`, cascade delete on steps, column names mapped to snake_case, table names mapped to lowercase plural | `prisma/schema.prisma` | 1.5 |
| 2.2 | Domain types re-exported from `@prisma/client` (`Plan`, `Step`, `PlanStatus`), `PlanWithSteps` via `Prisma.PlanGetPayload` | `src/server/types/domain.types.ts` | 2.1 |
| 2.3 | Plan repository: `createPlan`, `getPlan`, `getPlanWithSteps`, `updatePlan`, `markComplete` | `src/server/repositories/plan/plan.repository.ts` | 2.2 |
| 2.4 | Step repository: `createStep`, `updateStep`, `removeStep`, `getStepsByPlan` | `src/server/repositories/step/step.repository.ts` | 2.2 |
| 2.5 | Plan service: business logic wrapping plan repository | `src/server/services/plan/plan.service.ts` | 2.3 |
| 2.6 | Step service: business logic wrapping step repository | `src/server/services/step/step.service.ts` | 2.4 |
| 2.7 | Repository + service unit tests (CRUD, cascade, ordering) | `src/server/repositories/plan/plan.repository.test.ts`, `src/server/repositories/step/step.repository.test.ts`, `src/server/services/plan/plan.service.test.ts`, `src/server/services/step/step.service.test.ts` | 2.3-2.6 |

**Runnable after**: `npx prisma migrate dev`, repository tests pass, plans/steps in Postgres
