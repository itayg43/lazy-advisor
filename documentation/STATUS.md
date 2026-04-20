# Project Status

## Up Next: Clarify stage typed I/O refactor

Phases 1–4 complete (constants, schemas, fields, contribution, risk). Preferences phase being split into dedicated **equity** + **buffer** phases to eliminate bundled decision logic. See `CLARIFY_REFACTOR_PLAN.md` for full detail.

**Remaining implementation order:**

1. **Phase 5a — equity phase** — design settled; implementation pending. Architecture: `classifyEquityIntent` (separate `clarify.equity.classify.ts`) classifies `fields.goal` into one of four cases (`resolved` / `split_missing` / `no_specific_instrument` / `no_equity_stated`); code routes to a focused prompt per case; `runPhaseLoop` runs; extraction produces structured `allocations: EquityAllocation[]` + optional `preStatedBuffer`. Schemas already updated (`EquityAllocationSchema` + `EquityPhaseOutputSchema` in `clarify.schemas.ts`). See `CLARIFY_REFACTOR_PLAN.md` for full decision log.
2. **Phase 5b — buffer phase** — new `buffer/` directory; add `BufferPhaseOutputSchema`; early-exit branch when `preStatedBuffer` present (unit-tested); full conversation loop otherwise.
3. **Phase 6 — thin extraction** — signature takes four phase outputs; flatten `UserProfileSchema` to top-level `equity: EquityAllocation[]` + `buffer: string` (retire `investmentPreferences` container); drop `brokerage`.
4. **Phase 7 — intake cleanup** — drop `contradictory`; update out-of-scope + unrealistic prompts; add clean-goal extraction (7d). Can run in parallel with 5a/5b.
5. **Phase 8 — orchestrator wiring** — replace responseId-chaining with typed I/O in `clarify.stage.ts`; rewrite stage test to mock at the OpenAI boundary. Gates everything.
6. **Phase 9 — eval alignment pass** — update equity/buffer/extraction/stage evals for new shape.
7. **Phase 10 — rules files** — extract inline prompts for classify + intake handlers into co-located `.rules.md` files.

> **Note:** Stage-level evals (`clarify.stage.eval.ts`) remain broken during the Phase 5–8 refactor window — the orchestrator is being rewired phase-by-phase. Deferred until Phase 8 completes the orchestrator rewire. Broken runs in `clarify.stage.runs.jsonl` are expected.


