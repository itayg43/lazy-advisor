# Project Status

## Up Next

**Before starting 4.4c — three prerequisite tasks:**

1. **Clarify stage eval review** — Review `CLARIFY_FIELDS_LAST_RUN.md` and `CLARIFY_PREFERENCES_LAST_RUN.md` and assess the amount and level of information the LLM returns to users — too brief, too verbose, appropriately detailed? Flag any quality issues.
2. **Research stage: examples → rules refactor** — Three parts: (a) convert `research.allocation.ts` prompt from single-example format to Decision Logic + multi-example format following the clarify stage pattern (`research.extraction.ts` is already converted); (b) rename `RESEARCH_EXAMPLES #N` eval tags to `RESEARCH_RULES #N` in both eval files; (c) update any doc references.
3. **Fix clarify stage phase transition messaging** — After the fields phase, the LLM says "Got it, I have all the details I need." then immediately asks more questions in the preferences phase, then says "Got it, I have everything I need." again. Fix: remove the completion message from the fields phase — it should stop asking questions silently. The single completion signal at the end of preferences is sufficient.

After all three are complete: **4.4c — Phase B + orchestration + unit tests + full-loop eval.**

### Flagged from eval review
- **Preferences Test 1 — wrong riskTolerance extraction:** User said "a 20% drop would stress me but I wouldn't sell" → extracted as `conservative` but this is `moderate` behavior (holds through drawdown, just stressed). Investigate extraction logic.

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

