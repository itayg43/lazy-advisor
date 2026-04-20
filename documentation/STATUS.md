# Project Status

## Up Next: Clarify stage typed I/O refactor

Phases 1–4 complete. **Phase 5a (equity) paused** pending two upstream fixes. **Phase 4 re-open (two-tier risk) is next**, then 5a resumes.

See [`CLARIFY_REFACTOR_PLAN.md`](../CLARIFY_REFACTOR_PLAN.md) for per-phase detail, signatures, and open design questions (including the 5a risk/instrument mismatch decision).

## Remaining work

1. **Phase 4 re-open** — two-tier risk probe.
2. **Phase 5a** — equity phase (classify-then-route).
3. **Phase 5b** — buffer phase.
4. **Phase 6** — thin extraction.
5. **Phase 7** — intake cleanup (parallelizable with 5a/5b).
6. **Phase 8** — orchestrator typed I/O. Gates everything.
7. **Phase 9** — eval alignment pass.
8. **Phase 10** — rules files for classify + intake.

> **Note:** Stage-level evals (`clarify.stage.eval.ts`) remain broken through the Phase 8 orchestrator rewire. Broken runs in `clarify.stage.runs.jsonl` are expected until then.
