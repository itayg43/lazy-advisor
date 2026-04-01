# Lazy Advisor — Development Plan

## Context

Tech stack: TypeScript, Vitest, Express + WebSocket, Prisma + PostgreSQL, Redis, OpenAI API (including built-in web search). Tasks are broken into small, independently completable units.

When writing or finalizing a plan section, add a `### Design Decisions` block documenting non-obvious architectural choices and their reasoning. Discuss these decisions with the user before documenting them.

When a design decision is used by 2+ sections, promote it to `CONVENTIONS.md` and replace the original entry with a cross-reference (e.g., "See [CONVENTIONS.md — Error Handling](../../CONVENTIONS.md#error-handling)").

## Task Grouping

Tasks within a section are intentionally granular for dependency tracking, but related tasks are typically implemented together in a single PR. Common groupings:

- **Schema + types + registration** (e.g., 4.1–4.2) — define the data shapes before implementation
- **Implementation + unit tests** (e.g., 4.4–4.5) — code and its tests in one PR
- **Evals + doc updates** (e.g., 4.6–4.7) — validation and documentation as a closing PR

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


