# Project Status

> **When closing a task, update all three:** (1) the section status table below, (2) Up Next, (3) the relevant plan section in `documentation/plan/plan-sections/`.

## Up Next

**Next task: Fix flaky clarify eval — "should ask for percentage split when multiple instruments are named and capture it"**
The model sometimes bundles the split question into the same multi-field message as other profile questions. The scripted user only answers the profile fields, so the split goes unanswered and the model extracts without a percentage. Fix is in the clarify stage prompt — the split question must be asked as a separate follow-up, not bundled with other fields. Identified via `clarify.stage.last-run.md` on 2026-04-09.

**After that: 4.4c — Phase B + orchestration + unit tests + full-loop eval.**
Tasks 4.4c, 4.4d, 4.7 remaining in Section 4. See [PLAN_SECTION_4.md](plan/plan-sections/PLAN_SECTION_4.md) for full task details.

## Section Status

| Section | Status |
|---------|--------|
| 1 — Project Setup | Complete (task 1.6 deferred to Section 7) |
| 2 — Database Layer | Complete |
| 3 — Stage 1 — Clarify | Complete |
| 4 — Stage 2 — Research | In progress (4.4c, 4.4d, 4.7 remaining) |
| 5 — Stage 3 — Plan | Not started |
| 6 — Stage 4 — Iterate | Not started |
| 7 — WebSocket + Session Lifecycle | Not started |
| 8 — CLI Client | Not started |
| 9 — Middleware Layer | Not started |
| 10 — Observability | Not started |
| 11 — Integration Testing + Polish | Not started |
| 12 — Eval Infrastructure | Complete |

## Infrastructure

- CI pipeline, branch protection, `format:check` script — complete
- `dotenvx` encryption for `.env`/`.env.test`, `secretlint` pre-commit hook, prisma convenience scripts — complete
