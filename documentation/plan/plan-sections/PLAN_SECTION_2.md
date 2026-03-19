## Section 2: Database Layer

**Goal**: Prisma schema, migrations, CRUD repositories for plans and steps with tests against real Postgres.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 2.1 | Prisma schema: Plan + Step models, relations, cascade delete | `prisma/schema.prisma` | 1.5 |
| 2.2 | Domain types (decoupled from Prisma): `Plan`, `Step`, `PlanWithSteps` | `src/server/types/domain.types.ts` | 2.1 |
| 2.3 | Plan repository: `createPlan`, `getPlan`, `getPlanWithSteps`, `updatePlan`, `markComplete` | `src/server/repositories/plan/plan.repository.ts` | 2.2 |
| 2.4 | Step repository: `createStep`, `updateStep`, `removeStep`, `getStepsByPlan` | `src/server/repositories/step/step.repository.ts` | 2.2 |
| 2.5 | Plan service: business logic wrapping plan repository | `src/server/services/plan/plan.service.ts` | 2.3 |
| 2.6 | Step service: business logic wrapping step repository | `src/server/services/step/step.service.ts` | 2.4 |
| 2.7 | Repository + service unit tests (CRUD, cascade, ordering) | `src/server/repositories/plan/plan.repository.test.ts`, `src/server/repositories/step/step.repository.test.ts`, `src/server/services/plan/plan.service.test.ts`, `src/server/services/step/step.service.test.ts` | 2.3-2.6 |

**Runnable after**: `npx prisma migrate dev`, repository tests pass, plans/steps in Postgres
