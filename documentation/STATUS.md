# Project Status

## Up Next: Clarify stage typed I/O refactor

Phases 1–4 complete, including **Phase 4 re-open (2026-04-21)** — risk phase rewritten as a single-question 1–5 self-rating. **Phase 4b (allocation)** is next, then **Phase 5a (equity) resumes** with its revised scope.

See [`CLARIFY_REFACTOR_PLAN.md`](../CLARIFY_REFACTOR_PLAN.md) for per-phase detail, signatures, and design decisions. Risk-phase rationale and rejected alternatives live in [`clarify.risk.research-notes.md`](../src/server/pipeline/stages/clarify/risk/clarify.risk.research-notes.md).

## Remaining work

1. **Phase 4b** — allocation phase (equity vs. buffer sizing at total-portfolio level). New phase between risk and equity.
2. **Phase 5a** — equity phase (classify-then-route). Depends on 4b.
3. **Phase 5b** — buffer phase. Depends on 4b and 5a.
4. **Phase 6** — thin extraction. UserProfile gains flat `equityPercentage`/`bufferPercentage` fields; `investmentPreferences` string replaced with `equity: EquityAllocation[]` + `buffer: string`.
5. **Phase 7** — intake cleanup (parallelizable with 5a/5b/4b).
6. **Phase 8** — orchestrator typed I/O. Gates everything.
7. **Phase 9** — eval alignment pass.
8. **Phase 10** — rules files for classify + intake.

**Strict chain:** Phase 4 re-open → 4b → 5a → 5b. Allocation output feeds both equity and buffer as grounding context.

> **Note:** Stage-level evals (`clarify.stage.eval.ts`) remain broken through the Phase 8 orchestrator rewire. Broken runs in `clarify.stage.runs.jsonl` are expected until then.
