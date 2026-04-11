# Project Status

> **When closing a task, update all three:** (1) the section status table below, (2) Up Next, (3) the relevant plan section in `documentation/plan/plan-sections/`.

## Up Next

**Next task: 4.4c — Phase B + orchestration + unit tests + full-loop eval.**
Tasks 4.4c, 4.4d, 4.7 remaining in Section 4. See [PLAN_SECTION_4.md](plan/plan-sections/PLAN_SECTION_4.md) for full task details.

## Known Flaky Evals (investigate before 4.4c)

Two tests in `clarify.stage.eval.ts` fail intermittently — both are model behavior issues, not assertion or wiring bugs. See `CLARIFY_STAGE_LAST_RUN.md` for the latest transcripts.

**1. "should handle unrealistic expectations and extract profile after redirect"**
The model gets stuck asking the user to choose between the original short-term goal (double in 6 months) and the long-term pivot, even after the user has moved on and answered with portfolio preferences. Expected: model accepts the long-term pivot and proceeds to extraction. Actual: model loops on the A/B goal disambiguation question, runs out of scripted responses.

**2. "should resolve contradictory input and extract correct risk tolerance"**
After the user says "FTSE All-World. קרן כספית for the buffer.", the model asks for a percentage split between the two, treating the buffer as an equity allocation rather than understanding the answer is already complete. Expected: model recognises FTSE All-World as the equity leg and קרן כספית as the buffer, and proceeds to extraction without asking for a split. Actual: asks for a percentage, runs out of scripted responses.

## Known Schema Ambiguity (investigate before using extraction in production)

The clarify extractor occasionally returns hedged string values for enum fields when the user's input is ambiguous — e.g., `risk: "moderate or aggressive"` or `knowledgeLevel: "intermediate or advanced"`. These pass through extraction without validation errors because the extractor does not enforce a strict enum on output; it returns the model's raw text.

**Root cause (suspected):** The extraction prompt does not explicitly instruct the model to pick the closest single enum value when the user hedges. The model mirrors the user's phrasing instead of resolving it.

**Impact:** Downstream stages (research, plan) that read `risk` or `knowledgeLevel` may receive an unexpected string value that doesn't match any enum member, causing silent mismatch or runtime failure.

**Suggested investigation:**
- Add a Zod parse + assert in the extraction eval to catch non-enum values early (currently only `assertValidProfile` checks the schema, which may not cover all edge cases)
- Review the extraction prompt — add an explicit instruction to resolve ambiguous input to the nearest single enum value
- Consider adding a normalization step post-extraction if the prompt fix alone is insufficient

See `CLARIFY_EXAMPLES.md` Scenario 8 for the concrete example and the note added there.

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

- CI pipeline, branch protection, format enforcement — complete
- `dotenvx` encryption for `.env`/`.env.test`, `secretlint` pre-commit hook, prisma convenience scripts — complete
