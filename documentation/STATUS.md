# Project Status

## Up Next

1. **Implement clarify stage redesign** — Per `CLARIFY_REVIEW.md` (finalized spec). Implementation order:
   1. Structured phase passing (foundation) — typed I/O contracts, remove `buildSourceParams` and cross-phase `previous_response_id` chaining
   2. Risk phase — new dedicated phase between fields and preferences; resolves `riskTolerance` via personalized A/B drop scenario
   3. Fields, preferences, extraction updated to new contracts
   4. Intake phase prompt improvements and eval expansions
   5. Constants file (`clarify.constants.ts`) — benchmark figures + `buildRiskScenario`

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

