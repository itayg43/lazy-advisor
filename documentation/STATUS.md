# Project Status

## Up Next: Clarify stage typed I/O refactor

**Phase 8 shipped 2026-04-22.** `preferences` and `extraction` phases removed. All completed phases wired with typed I/O: classify → intake (incl. contradictory) → fields → risk → allocation → contribution → inline `UserProfile` assembly. Stage unit test added. **Phase 5a (equity) is next.**

See [`CLARIFY_REFACTOR_PLAN.md`](../CLARIFY_REFACTOR_PLAN.md) for per-phase detail, signatures, and design decisions. Research notes and rejected alternatives live in [`clarify.risk.research-notes.md`](../src/server/pipeline/stages/clarify/risk/clarify.risk.research-notes.md) and [`clarify.allocation.research-notes.md`](../src/server/pipeline/stages/clarify/allocation/clarify.allocation.research-notes.md).

## Remaining work

1. **Phase 5a** — equity phase (classify-then-route). Consumes `AllocationPhaseOutput`.
2. **Phase 5b** — buffer phase. Depends on 5a. When 5a/5b land, `UserProfile` gains `equity: EquityAllocation[]` + `buffer: string`.
3. **Phase 7** — intake cleanup: update out-of-scope and unrealistic prompts; add `redirectedGoal` extraction post-acceptance (Phase 7d). Parallelizable with 5a/5b.
4. **Phase 9** — eval alignment pass.
5. **Phase 10** — rules files for classify + intake.

**Strict chain:** 5a → 5b. Allocation output feeds both equity and buffer as grounding context.

## Deferred follow-ups

- **Cross-phase context enrichment pass — review what each phase currently receives vs. what earlier phase outputs could provide.** Walk through the full phase chain (classify → intake → fields → risk → allocation → contribution) and evaluate: (a) which earlier outputs are available but not yet passed to a later phase, (b) whether passing them would meaningfully improve the phase's conversation quality or extraction accuracy. Examples to investigate: passing `fields` financial context into `risk` framing, passing `risk` and `fields` into `contribution` context string, using `classification` result to enrich the `fields` system prompt. Do before the timeline enum change — findings may influence what `FieldsPhaseOutput` and other phase I/O shapes look like.

- **Fields phase timeline — replace free text with 4-bucket enum aligned with allocation anchor table.** Current `timeline: string` is interpreted by the allocation prompt into one of four anchor cells (`< 3 yr | 3–5 yr | 5–10 yr | 10+ yr`). Replace with a presented-choice enum (`"under 3 years" | "3–5 years" | "5–10 years" | "10+ years"`) that maps 1:1 to the anchor table — removing the interpretation step entirely and tightening the schema boundary. Touches: fields phase prompt (present options instead of open-ended ask), allocation phase prompt (drop "interpreted timeline bucket" language, look up cell directly), `FieldsPhaseOutputSchema` (string → enum). Do after Phase 8 closes.

- **Allocation shekel math — move from model into code.** The allocation prompt currently instructs the model to compute equity/buffer shekel amounts and verify the sum. A cleaner design pre-computes the amounts in TypeScript per candidate percentage and passes them as grounding, removing one class of arithmetic bugs (the "₪85,000 + ₪15,000 of ₪50,000" bug caught in the first eval run). Architecture improvement, not urgent — current prompt discipline plus shekel-sum eval assertions hold.
- **EF / debt as stage-level suitability gate (Phase 7 follow-up).** `hasEmergencyFund` and `hasDebt` are collected in the fields phase but not consumed by any downstream phase. An earlier allocation design used them as mid-conversation qualifiers (dropped — weak ROI). The correct position is a stage-level gate *before* field collection, modeled on the intake rejection pattern: if the user lacks an EF or carries high-interest debt, surface the concern and let the user decline before committing to a long clarify flow. Decide during Phase 7.
