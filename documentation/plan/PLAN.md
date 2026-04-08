# Lazy Advisor — Development Plan

## Context

Tech stack: TypeScript, Vitest, Express + WebSocket, Prisma + PostgreSQL, Redis, OpenAI API (including built-in web search). Tasks are broken into small, independently completable units.

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
| 12 | Eval Infrastructure | [PLAN_SECTION_12.md](plan-sections/PLAN_SECTION_12.md) |

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


