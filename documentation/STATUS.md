# Project Status

## Up Next: Clarify stage typed I/O refactor

Phases 1–4 complete (single 20% probe). **Phase 4 re-open is in progress — design decided 2026-04-21, implementation pending.** After a web-verified research pass on risk-tolerance assessment, the two-tier A/B drop scenario was replaced with a single-question 1–5 self-rating. The switch was driven by published research (direct self-rating outpredicts hypothetical scenarios; historical-recovery framing introduces documented priming bias) and removes the prior design's intermittent prompt-adherence flake by eliminating the multi-step flow entirely. See [`clarify.risk.research-notes.md`](../src/server/pipeline/stages/clarify/risk/clarify.risk.research-notes.md) for findings, sources, rejected alternatives (including a pension-past-behavior probe), and honest trade-offs. After implementation, **Phase 4b (allocation)** is next, then **Phase 5a (equity) resumes** with its revised scope.

See [`CLARIFY_REFACTOR_PLAN.md`](../CLARIFY_REFACTOR_PLAN.md) for per-phase detail, signatures, and design decisions. The 5a risk/instrument mismatch is **resolved** by Phase 4b — sizing protects behavior regardless of instrument choice.

## Remaining work

1. **Phase 4 re-open (implementation)** — rewrite risk phase as a single-question 1–5 self-rating with deterministic score→bucket mapping. Updates: `clarify.risk.ts`, `clarify.risk.rules.md`, `clarify.risk.prompts.ts`, `clarify.risk.eval.ts`, `RiskPhaseOutputSchema` (add `selfRatingScore`), `MAX_RISK_TOOL_CALLS` (reduce to 2).
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
