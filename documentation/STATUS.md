# Project Status

## Up Next

1. **Cleanup (prerequisite to Phase 5a)** — See `CLEANUP_PLAN.md`.
   - Phase A (code deletion) — **Complete.** Deleted research stage, plan/step repos+services, Prisma, Docker, Redis. Stripped research schemas from `pipeline.schema.ts`. Clarify-only env vars.
   - Phase B (doc alignment) — Not started.
   - Phase C (fields eval Case 1 rewrite) — Not started.

2. **Clarify stage typed I/O refactor** — Phases 1–4 complete (constants, schemas, fields, contribution, risk). Preferences phase being split into dedicated **equity** + **buffer** phases to eliminate bundled decision logic. See `CLARIFY_REFACTOR_PLAN.md` for full detail.

   **Remaining implementation order:**

   1. **Phase 5a — equity phase** — design settled; implementation pending. Architecture: `classifyEquityIntent` (separate `clarify.equity.classify.ts`) classifies `fields.goal` into one of four cases (`resolved` / `split_missing` / `no_specific_instrument` / `no_equity_stated`); code routes to a focused prompt per case; `runPhaseLoop` runs; extraction produces structured `allocations: EquityAllocation[]` + optional `preStatedBuffer`. Schemas already updated (`EquityAllocationSchema` + `EquityPhaseOutputSchema` in `clarify.schemas.ts`). See `CLARIFY_REFACTOR_PLAN.md` for full decision log.
   2. **Phase 5b — buffer phase** — new `buffer/` directory; add `BufferPhaseOutputSchema`; early-exit branch when `preStatedBuffer` present (unit-tested); full conversation loop otherwise.
   3. **Phase 6 — thin extraction** — signature takes four phase outputs; flatten `UserProfileSchema` to top-level `equity: EquityAllocation[]` + `buffer: string` (retire `investmentPreferences` container); drop `brokerage`.
   4. **Phase 7 — intake cleanup** — drop `contradictory`; update out-of-scope + unrealistic prompts; add clean-goal extraction (7d). Can run in parallel with 5a/5b.
   5. **Phase 8 — orchestrator wiring** — replace responseId-chaining with typed I/O in `clarify.stage.ts`; rewrite stage test to mock at the OpenAI boundary. Gates everything.
   6. **Phase 9 — eval alignment pass** — update equity/buffer/extraction/stage evals for new shape.
   7. **Phase 10 — rules files** — extract inline prompts for classify + intake handlers into co-located `.rules.md` files.

   > **Note:** Stage-level evals (`clarify.stage.eval.ts`) remain broken during the Phase 5–8 refactor window — the orchestrator is being rewired phase-by-phase. Deferred until Phase 8 completes the orchestrator rewire. Broken runs in `clarify.stage.runs.jsonl` are expected.

2. **Research stage: examples → rules refactor** — Four parts: (a) convert `research.allocation.ts` prompt from single-example format to Decision Logic + multi-example format following the clarify stage pattern (`research.extraction.ts` is already converted); (b) rename `RESEARCH_EXAMPLES #N` eval tags to `RESEARCH_RULES #N` in both eval files; (c) update any doc references; (d) review research stage prompts for missing terminal-state steps (e.g. explicit "stop" instructions for rejection/disengagement), following the pattern added to the clarify intake prompts.

3. **4.4c — Phase B + orchestration + unit tests + full-loop eval.**

### Deferred: Crypto ETF support (clarify + research)
Crypto ETFs (e.g., BlackRock's IBIT for Bitcoin, ETHA for Ethereum) are SEC-regulated ETFs tradeable through a normal brokerage — they should be treated as a legitimate aggressive investment preference, not redirected as out-of-scope alongside direct crypto purchases. Currently the clarify fields prompt groups all crypto together. Deferred until the research stage is otherwise complete.

**When implementing:**
1. Update clarify fields redirect rule to distinguish direct crypto (out of scope) vs crypto ETFs (valid aggressive preference — capture in `investmentPreferences`)
2. Update research stage to handle crypto ETF as a portfolio instrument

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

