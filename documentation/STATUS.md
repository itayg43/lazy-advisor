# Project Status

## Up Next: Clarify stage typed I/O refactor

Phases 1–4b complete. **Phase 4b (allocation) shipped 2026-04-21** — 2-axis risk × timeline anchor, 4 behavioral rules, 10 evals passing (full behavior and flow documented in [`ARCHITECTURE.md`](./ARCHITECTURE.md#allocation-phase--2-axis-anchor-risk-tolerance--timeline)). Not yet wired into `clarify.stage.ts` — that's Phase 8. **Phase 5a (equity) resumes next** with its revised scope (classify-then-route, consumes `allocation.equityPercentage`).

See [`CLARIFY_REFACTOR_PLAN.md`](../CLARIFY_REFACTOR_PLAN.md) for per-phase detail, signatures, and design decisions. Research notes and rejected alternatives live in [`clarify.risk.research-notes.md`](../src/server/pipeline/stages/clarify/risk/clarify.risk.research-notes.md) and [`clarify.allocation.research-notes.md`](../src/server/pipeline/stages/clarify/allocation/clarify.allocation.research-notes.md).

## Remaining work

1. **Phase 5a** — equity phase (classify-then-route). Consumes `AllocationPhaseOutput`.
2. **Phase 5b** — buffer phase. Depends on 5a.
3. **Phase 6** — thin extraction. UserProfile gains flat `equityPercentage`/`bufferPercentage` fields; `investmentPreferences` string replaced with `equity: EquityAllocation[]` + `buffer: string`.
4. **Phase 7** — intake cleanup (parallelizable with 5a/5b).
5. **Phase 8** — orchestrator typed I/O. Wires 4b, 5a, 5b into `clarify.stage.ts`. Gates everything.
6. **Phase 9** — eval alignment pass.
7. **Phase 10** — rules files for classify + intake.

**Strict chain:** 5a → 5b. Allocation output feeds both equity and buffer as grounding context.

> **Note:** Stage-level evals (`clarify.stage.eval.ts`) remain broken through the Phase 8 orchestrator rewire. Broken runs in `clarify.stage.runs.jsonl` are expected until then.

## Deferred follow-ups

- **Allocation shekel math — move from model into code.** The allocation prompt currently instructs the model to compute equity/buffer shekel amounts and verify the sum. A cleaner design pre-computes the amounts in TypeScript per candidate percentage and passes them as grounding, removing one class of arithmetic bugs (the "₪85,000 + ₪15,000 of ₪50,000" bug caught in the first eval run). Architecture improvement, not urgent — current prompt discipline plus shekel-sum eval assertions hold.
- **EF / debt as stage-level suitability gate (Phase 7 follow-up).** `hasEmergencyFund` and `hasDebt` are collected in the fields phase but not consumed by any downstream phase. An earlier allocation design used them as mid-conversation qualifiers (dropped — weak ROI). The correct position is a stage-level gate *before* field collection, modeled on the intake rejection pattern: if the user lacks an EF or carries high-interest debt, surface the concern and let the user decline before committing to a long clarify flow. Decide during Phase 7.

> **Doc drift to resolve in Phase 7:** `clarify.stage.rules.md` rule 4 ("Contradictory risk → scenario-based resolution") still describes the removed A/B/C loss-scenario path. Contradiction is now handled by the risk phase's 1–5 self-rating (ARCHITECTURE.md:81). Remove or rewrite this rule when Phase 7 (intake cleanup — drop `contradictory`) runs.
