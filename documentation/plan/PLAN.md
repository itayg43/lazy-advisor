# Lazy Advisor — Development Plan

## Context

Tech stack: TypeScript, Vitest, Express + WebSocket, Prisma + PostgreSQL, Redis, OpenAI API (including built-in web search). Tasks are broken into small, independently completable units.

When writing or finalizing a plan section, add a `### Design Decisions` block documenting non-obvious architectural choices and their reasoning. Discuss these decisions with the user before documenting them.

When a design decision is used by 2+ sections, promote it to `CONVENTIONS.md` and replace the original entry with a cross-reference (e.g., "See [CONVENTIONS.md — Error Handling](../../CONVENTIONS.md#error-handling)").

## Folder Structure

```
lazy-advisor/
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── vitest.config.repositories.ts
├── vitest.config.evals.ts
├── prisma.config.ts
├── .env.example
├── .env.test.example
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── server/
│   │   ├── server.ts                   # Server initialization (listen, shutdown)
│   │   ├── app.ts                      # Express app setup (middleware, routes, CORS)
│   │   ├── config.ts                   # Env vars, validated with dotenv + envalid
│   │   ├── ws/
│   │   │   ├── handler/
│   │   │   │   ├── handler.ts          # WebSocket upgrade + message routing
│   │   │   │   ├── handler.integration.test.ts
│   │   │   │   └── index.ts
│   │   │   ├── events.ts               # Event type definitions + serializers
│   │   │   └── session.ts              # Session class (in-memory state, timeout)
│   │   ├── middlewares/
│   │   │   ├── auth/
│   │   │   │   ├── auth.middleware.ts   # API key middleware
│   │   │   │   ├── auth.middleware.test.ts
│   │   │   │   └── index.ts
│   │   │   └── rate-limiter/
│   │   │       ├── rate-limiter.middleware.ts # Redis-backed rate limiter
│   │   │       ├── rate-limiter.middleware.test.ts
│   │   │       └── index.ts
│   │   ├── pipeline/
│   │   │   ├── orchestrator/
│   │   │   │   ├── orchestrator.ts      # Runs stages in sequence, validates handoffs
│   │   │   │   ├── orchestrator.integration.test.ts
│   │   │   │   └── index.ts
│   │   │   ├── stages/
│   │   │   │   ├── clarify/
│   │   │   │   │   ├── clarify.stage.ts
│   │   │   │   │   ├── clarify.stage.test.ts
│   │   │   │   │   ├── clarify.stage.eval.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── research/
│   │   │   │   │   ├── research.stage.ts
│   │   │   │   │   ├── research.stage.test.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── plan/
│   │   │   │   │   ├── plan.stage.ts
│   │   │   │   │   ├── plan.stage.test.ts
│   │   │   │   │   └── index.ts
│   │   │   │   └── iterate/
│   │   │   │       ├── iterate.stage.ts
│   │   │   │       ├── iterate.stage.test.ts
│   │   │   │       └── index.ts
│   │   │   └── tools/
│   │   │       ├── index.ts               # Tool registry — maps stage names to allowed Tool[]
│   │   │       ├── ask-user.tool.ts
│   │   │       ├── create-step.tool.ts
│   │   │       ├── update-step.tool.ts
│   │   │       ├── remove-step.tool.ts
│   │   │       └── finish-plan.tool.ts
│   │   ├── schemas/
│   │   │   └── pipeline.schema.ts       # Zod schemas for all stage boundaries
│   │   ├── types/
│   │   │   ├── domain.types.ts          # Domain types (Plan, Step, Phase)
│   │   │   └── pipeline.types.ts        # Pipeline types inferred from Zod schemas
│   │   ├── repositories/
│   │   │   ├── plan/
│   │   │   │   ├── plan.repository.ts   # Prisma CRUD for plans
│   │   │   │   ├── plan.repository.test.ts
│   │   │   │   └── index.ts
│   │   │   └── step/
│   │   │       ├── step.repository.ts   # Prisma CRUD for steps
│   │   │       ├── step.repository.test.ts
│   │   │       └── index.ts
│   │   ├── services/
│   │   │   ├── plan/
│   │   │   │   ├── plan.service.ts      # Plan business logic
│   │   │   │   ├── plan.service.test.ts
│   │   │   │   └── index.ts
│   │   │   ├── step/
│   │   │   │   ├── step.service.ts      # Step business logic
│   │   │   │   ├── step.service.test.ts
│   │   │   │   └── index.ts
│   │   │   └── openai/
│   │   │       ├── openai.service.ts    # callOpenAI + callOpenAIParsed (retry, validation, token logging)
│   │   │       ├── openai.service.test.ts
│   │   │       └── index.ts
│   │   ├── clients/
│   │   │   ├── prisma.client.ts         # Prisma client singleton (PrismaPg adapter)
│   │   │   └── openai.client.ts         # OpenAI client singleton
│   │   ├── mocks/
│   │   │   └── openai.service.mock.ts   # OpenAI service mock helpers (shared across stage tests)
│   │   ├── errors/
│   │   │   └── index.ts                 # Custom error classes
│   │   ├── observability/
│   │   │   ├── logger.ts                # Structured JSON logger
│   │   │   └── metrics.ts               # Prometheus metrics
│   │   └── lib/
│   │       └── with-retry/
│   │           ├── with-retry.ts        # Generic retry with exponential backoff
│   │           ├── with-retry.test.ts
│   │           └── index.ts
│   │       └── logger/
│   │           ├── logger.ts            # createLogger factory (human-readable dev logging)
│   │           └── index.ts
│   ├── cli/
│   │   ├── cli.ts                      # CLI initialization (parse args, start, shutdown)
│   │   ├── app.ts                      # Wire connection + renderer + input together
│   │   ├── config.ts                   # CLI-specific config (server URL, auth token)
│   │   ├── connection.ts               # WebSocket client
│   │   ├── renderer.ts                 # Formats and prints events to terminal
│   │   └── input.ts                    # stdin handling for user responses
│   └── shared/
│       ├── types/
│       │   └── events.types.ts         # Event type definitions shared by client+server
│       └── constants/
│           └── constants.ts            # Shared constants (timeouts, caps, etc.)
```

---

## Sections

| # | Section | File |
|---|---------|------|
| 1 | Project Setup | [PLAN_SECTION_1.md](plan-sections/PLAN_SECTION_1.md) |
| 2 | Database Layer | [PLAN_SECTION_2.md](plan-sections/PLAN_SECTION_2.md) |
| 3 | Stage 1 — Clarify | [PLAN_SECTION_3.md](plan-sections/PLAN_SECTION_3.md) |
| 4 | Stage 2 — Research | [PLAN_SECTION_4.md](plan-sections/PLAN_SECTION_4.md) |
| 5 | Stage 3 — Plan | [PLAN_SECTION_5.md](plan-sections/PLAN_SECTION_5.md) |
| 6 | Stage 4 — Iterate | [PLAN_SECTION_6.md](plan-sections/PLAN_SECTION_6.md) |
| 7 | WebSocket + Session Lifecycle | [PLAN_SECTION_7.md](plan-sections/PLAN_SECTION_7.md) |
| 8 | CLI Client | [PLAN_SECTION_8.md](plan-sections/PLAN_SECTION_8.md) |
| 9 | Middleware Layer | [PLAN_SECTION_9.md](plan-sections/PLAN_SECTION_9.md) |
| 10 | Observability | [PLAN_SECTION_10.md](plan-sections/PLAN_SECTION_10.md) |
| 11 | Integration Testing + Polish | [PLAN_SECTION_11.md](plan-sections/PLAN_SECTION_11.md) |

---

## Dependency Graph

```
Section 1 (Setup)
    ├── Section 2 (Database)
    ├── Section 3 (Clarify)
    │       └── Section 4 (Research)
    │               └── Section 5 (Plan) ← also depends on Section 2
    │                       └── Section 6 (Iterate)
    │                               └── Section 7 (WebSocket)
    │                                       └── Section 8 (CLI)
    ├── Section 9 (Middleware) ← after Section 7
    ├── Section 10 (Observability) ← after Section 7
    └── Section 11 (Integration) ← after all

Sections 9 and 10 are independent of each other.
```

## Zod Schema Locations

All pipeline schemas in `src/server/schemas/pipeline.schema.ts`:
- **Stage 1→2**: `UserProfileSchema`
- **Stage 2→3**: `ResearchSummarySchema`
- **Stage 3→4**: `PlanOutputSchema`
- **Feedback**: `FeedbackClassificationSchema`

Other validation:
- `src/server/config.ts` — env var validation (dotenv + envalid)
- `src/server/ws/events.ts` — incoming WS message validation (Zod)

