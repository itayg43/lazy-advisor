# Project Status

## Up Next: Clarify stage typed I/O refactor

Phases 1–4 complete (single 20% probe). **Phase 4 re-open (two-tier risk probe) is in progress** — the prompt-based state machine lands the flow but has an intermittent adherence flake on the uncertain-on-Turn-1 → educational fallback path (~1 in 3–4 runs, model short-circuits to Step 6 instead of executing mandatory Step 4). Next step is a code-based refactor: move the state machine out of the prompt into code (LLM classifier per user reply + deterministic branching, small focused prompts per node). After that, **Phase 4b (allocation)** is next, then **Phase 5a (equity) resumes** with its revised scope.

See [`CLARIFY_REFACTOR_PLAN.md`](../CLARIFY_REFACTOR_PLAN.md) for per-phase detail, signatures, and design decisions. The 5a risk/instrument mismatch is **resolved** by Phase 4b — sizing protects behavior regardless of instrument choice.

## Remaining work

1. **Phase 4 re-open (continued)** — break risk phase into code (state machine) + small focused prompts (generation + classification nodes only).
2. **Phase 4b** — allocation phase (equity vs. buffer sizing at total-portfolio level). New phase between risk and equity.
3. **Phase 5a** — equity phase (classify-then-route). Depends on 4b.
4. **Phase 5b** — buffer phase. Depends on 4b and 5a.
5. **Phase 6** — thin extraction. UserProfile gains flat `equityPercentage`/`bufferPercentage` fields; `investmentPreferences` string replaced with `equity: EquityAllocation[]` + `buffer: string`.
6. **Phase 7** — intake cleanup (parallelizable with 5a/5b/4b).
7. **Phase 8** — orchestrator typed I/O. Gates everything.
8. **Phase 9** — eval alignment pass.
9. **Phase 10** — rules files for classify + intake.

**Strict chain:** Phase 4 re-open → 4b → 5a → 5b. Allocation output feeds both equity and buffer as grounding context.

> **Note:** Stage-level evals (`clarify.stage.eval.ts`) remain broken through the Phase 8 orchestrator rewire. Broken runs in `clarify.stage.runs.jsonl` are expected until then.
