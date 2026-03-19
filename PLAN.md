# Lazy Advisor — Development Plan

## Context

Building `lazy-advisor` from scratch — an agentic investment planning CLI for beginner ETF investors. This is a portfolio project demonstrating agentic workflows with multi-turn conversation and WebSocket streaming. The developer is a junior dev, so tasks are broken into small, independently completable units.

Tech stack: TypeScript, Vitest, Express + WebSocket, Prisma + PostgreSQL, Redis, OpenAI API, Tavily API.

## Folder Structure

```
lazy-advisor/
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── .eslintrc.cjs
├── .prettierrc
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
│   │   │   ├── tools/
│   │   │   │   ├── ask-user.tool.ts
│   │   │   │   ├── search.tool.ts
│   │   │   │   ├── create-step.tool.ts
│   │   │   │   ├── update-step.tool.ts
│   │   │   │   ├── remove-step.tool.ts
│   │   │   │   └── finish-plan.tool.ts
│   │   │   └── tool-registry.ts         # Maps tool names to handlers per stage
│   │   ├── schemas/
│   │   │   └── pipeline.schema.ts       # Zod schemas for all stage boundaries
│   │   ├── types/
│   │   │   └── domain.types.ts          # Domain types (Plan, Step, Phase)
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
│   │   │   └── step/
│   │   │       ├── step.service.ts      # Step business logic
│   │   │       ├── step.service.test.ts
│   │   │       └── index.ts
│   │   ├── clients/
│   │   │   ├── openai.client.ts         # OpenAI client wrapper + retry
│   │   │   └── tavily.client.ts         # Tavily client wrapper + retry
│   │   ├── mocks/
│   │   │   ├── openai.mock.ts           # Mock OpenAI test helper
│   │   │   └── tavily.mock.ts           # Mock Tavily test helper
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

## Section 1: Project Setup

**Goal**: Working TypeScript project with linting, testing, Docker services, and folder skeleton. After this: `npm run test`, `npm run lint`, `npm run build` all pass.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 1.1 | Init repo, package.json, tsconfig (`strict`, `ES2022`, `NodeNext`) | `package.json`, `tsconfig.json` | — |
| 1.2 | ESLint + Prettier setup | `.eslintrc.cjs`, `.prettierrc` | 1.1 |
| 1.3 | Vitest setup + sanity test | `vitest.config.ts` | 1.1 |
| 1.4 | Folder skeleton + placeholder entry points, `dev:server` script with `tsx` | All dirs, `src/server/server.ts`, `src/server/app.ts`, `src/cli/cli.ts`, `src/cli/app.ts` | 1.1 |
| 1.5 | Docker Compose (Postgres 16 + Redis 7), `.env.example`, `.gitignore` | `docker-compose.yml`, `.env.example`, `.gitignore` | 1.1 |
| 1.6 | Config module with dotenv + envalid for env var validation | `src/server/config.ts` | 1.4 |
| 1.7 | Shared constants (caps, timeouts) + event types (discriminated unions) | `src/shared/constants/constants.ts`, `src/shared/types/events.types.ts` | 1.4 |
| 1.8 | Generic `withRetry` utility + unit tests | `src/server/lib/with-retry/with-retry.ts`, `src/server/lib/with-retry/with-retry.test.ts`, `src/server/lib/with-retry/index.ts` | 1.3 |

**Runnable after**: `npm run build`, `npm run test`, `npm run lint`, `docker compose up -d`

---

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

---

## Section 3: Stage 1 — Clarify

**Goal**: Given raw goal text, calls OpenAI with `ask_user` tool, asks adaptive questions, produces validated UserProfile.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 3.1 | Zod schemas for ALL stage boundaries: `UserProfileSchema`, `ResearchSummarySchema`, `PlanOutputSchema`, `FeedbackClassificationSchema` | `src/server/schemas/pipeline.schema.ts` | Section 1 |
| 3.2 | OpenAI client wrapper: `callOpenAI()` with retry, logging, token counting. Supports `cheapModel` for classification. | `src/server/clients/openai.client.ts` | 1.8, 1.6 |
| 3.3 | Mock OpenAI test helper | `src/server/mocks/openai.mock.ts` | 3.2 |
| 3.4 | `ask_user` tool: definition + handler. Decoupled from WebSocket via callbacks (`sendToUser`, `waitForResponse`) | `src/server/pipeline/tools/ask-user.tool.ts` | 3.1 |
| 3.5 | Tool registry: maps stage names to allowed tools | `src/server/pipeline/tool-registry.ts` | 3.4 |
| 3.6 | Clarify stage: system prompt, tool-calling loop, profile extraction, Zod validation, stage cap | `src/server/pipeline/stages/clarify/clarify.stage.ts` | 3.1, 3.2, 3.4, 3.5 |
| 3.7 | Clarify stage tests (detailed/minimal/contradictory input, validation failure, cap) | `src/server/pipeline/stages/clarify/clarify.stage.test.ts` | 3.3, 3.6 |

**Runnable after**: Clarify stage works in isolation with mock callbacks, produces validated UserProfile

---

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

---

## Section 5: Stage 3 — Plan

**Goal**: Given UserProfile + ResearchSummary, generates phased plan with steps persisted to DB.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 5.1 | `create_step` tool: calls stepService, emits `step_created` | `src/server/pipeline/tools/create-step.tool.ts` | 2.6 |
| 5.2 | `finish_plan` tool: calls planService.markComplete, emits `plan_complete` | `src/server/pipeline/tools/finish-plan.tool.ts` | 2.5 |
| 5.3 | Register plan tools in registry | `src/server/pipeline/tool-registry.ts` | 5.1, 5.2 |
| 5.4 | Plan stage: system prompt, tool-calling loop, educational output, stage cap → force finish | `src/server/pipeline/stages/plan/plan.stage.ts` | 3.1, 3.2, 5.1, 5.2 |
| 5.5 | Plan stage tests (happy path, step ordering, stage cap, DB persistence verification) | `src/server/pipeline/stages/plan/plan.stage.test.ts` | 3.3, 5.4 |

**Runnable after**: Plan stage creates plans/steps in Postgres, events emitted

---

## Section 6: Stage 4 — Iterate

**Goal**: Classifies user feedback, routes to adjust/research_and_adjust/clarify/done. Full pipeline logic complete.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 6.1 | `update_step` + `remove_step` tools: call stepService | `src/server/pipeline/tools/update-step.tool.ts`, `remove-step.tool.ts` | 2.6 |
| 6.2 | Register all iterate tools in registry | `src/server/pipeline/tool-registry.ts` | 6.1 |
| 6.3 | Feedback classifier: cheap model (`gpt-4o-mini`), returns validated `FeedbackClassification` | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 3.1, 3.2 |
| 6.4 | Iterate — `adjust` flow: modify plan in place with update/remove/create tools | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 6.1, 6.2, 6.3 |
| 6.5 | Iterate — `research_and_adjust` flow: update profile, re-run Research → Plan stages | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 6.3, Sections 4+5 |
| 6.6 | Iterate — `clarify` + `done` flows | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 6.3 |
| 6.7 | Iteration counter + limit enforcement (max 5, clarify doesn't count) | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 6.4-6.6 |
| 6.8 | Iterate stage tests (classification routing, each flow, iteration limit, mixed iterations) | `src/server/pipeline/stages/iterate/iterate.stage.test.ts` | 3.3, 4.2 |

**Runnable after**: Full iterate loop works in isolation — classify, route, modify, persist

---

## Section 7: WebSocket + Session Lifecycle

**Goal**: Express server + WS endpoint. Connect via `wscat`, run the full pipeline. First time everything works end-to-end.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 7.1 | Express app: CORS, `GET /health`, middleware | `src/server/app.ts`; Server init: HTTP server, listen, shutdown | `src/server/server.ts` | Section 1 |
| 7.2 | WebSocket handler: upgrade on `/api/v1/sessions/ws`, create session, route messages | `src/server/ws/handler/handler.ts` | 7.1 |
| 7.3 | Session class: state, `sendEvent()`, `waitForUserResponse()` (Promise-based), inactivity timer, `destroy()` | `src/server/ws/session.ts` | 1.7 |
| 7.4 | Event serialization: serialize server events, deserialize + Zod-validate client messages | `src/server/ws/events.ts` | 1.7 |
| 7.5 | Pipeline orchestrator: `runPipeline(session, goal)` — wires all stages, enforces Zod at boundaries, handles errors | `src/server/pipeline/orchestrator/orchestrator.ts` | Sections 3-6, 7.3 |
| 7.6 | Wire WS handler → orchestrator (first message = goal, subsequent = user responses) | `src/server/ws/handler/handler.ts` | 7.2, 7.5 |
| 7.7 | Session timeout (15min) + disconnect handling (reject pending promises) | `src/server/ws/session.ts` | 7.3 |
| 7.8 | WebSocket integration tests (full lifecycle, timeout, disconnect, malformed messages) | `src/server/ws/handler/handler.integration.test.ts` | 7.6, 7.7 |

**Runnable after**: `npm run dev:server` + `wscat` → full pipeline streams events back

---

## Section 8: CLI Client

**Goal**: `npx lazy-advisor "I want to invest $10k"` works end-to-end.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 8.1 | CLI config: server URL, auth token from env/config file | `src/cli/config.ts` | Section 7 |
| 8.2 | WebSocket client connection (connect, parse events, handle errors) | `src/cli/connection.ts` | 8.1 |
| 8.3 | Event renderer: format each event type for terminal (chalk for colors) | `src/cli/renderer.ts` | 1.7 |
| 8.4 | User input handling: readline, prompt on `clarification`, Ctrl+C graceful shutdown | `src/cli/input.ts` | 8.2 |
| 8.5 | CLI app: wire connection + renderer + input together | `src/cli/app.ts` | 8.2-8.4 |
| 8.6 | CLI entry point: parse args, print disclaimer, start app, graceful shutdown | `src/cli/cli.ts`, `package.json` (bin) | 8.5 |

**Runnable after**: Full happy path works from CLI

---

## Section 9: Middleware Layer

**Goal**: Auth + rate limiting protect the WebSocket endpoint.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 9.1 | API key auth (Bearer header or `?token=` query param for WS) | `src/server/middlewares/auth/auth.middleware.ts`, `src/server/config.ts` | 1.6 |
| 9.2 | Redis rate limiter (sliding window, N sessions/IP/hour) | `src/server/middlewares/rate-limiter/rate-limiter.middleware.ts` | 1.5, 1.6 |
| 9.3 | Apply middlewares to WS handler (auth → rate limit → upgrade) | `src/server/ws/handler/handler.ts` | 9.1, 9.2, 7.2 |
| 9.4 | CLI sends auth token (from env var or config file) | `src/cli/config.ts`, `src/cli/connection.ts` | 9.1 |
| 9.5 | Gateway tests (missing/invalid token, rate limit exceeded/reset) | `src/server/middlewares/auth/auth.middleware.test.ts`, `src/server/middlewares/rate-limiter/rate-limiter.middleware.test.ts` | 9.1, 9.2 |

**Runnable after**: Unauthorized/abusive clients rejected

---

## Section 10: Observability

**Goal**: Structured JSON logging + Prometheus metrics (`/metrics` endpoint).

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 10.1 | Structured logger (pino): base logger + child loggers with `sessionId`/`stage` | `src/server/observability/logger.ts` | Section 1 |
| 10.2 | Add logging to all pipeline stages + orchestrator | All stage files, orchestrator | 10.1 |
| 10.3 | Prometheus metrics: `http_request_duration_seconds`, `http_requests_total`, `openai_request_duration_seconds`, `openai_tokens_total` + `GET /metrics` | `src/server/observability/metrics.ts` | 7.1 |
| 10.4 | Instrument OpenAI wrapper with metrics (duration, tokens) | `src/server/clients/openai.client.ts` | 10.3, 3.2 |
| 10.5 | HTTP metrics middleware | `src/server/app.ts` | 10.3 |

**Runnable after**: `GET /metrics` returns Prometheus data, logs are structured JSON

---

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

## Verification

After each section, run:
- `npm run build` — TypeScript compiles
- `npm run test` — all tests pass
- `npm run lint` — no lint errors

Full E2E: `docker compose up -d && npm run dev:server` in one terminal, CLI in another.
