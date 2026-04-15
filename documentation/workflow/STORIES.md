# Lazy Advisor — Usage Stories

Realistic scenarios showing how the CLI works in practice. MVP scope: single sessions with plan persistence, no cross-session memory.

The agent is **educational by default** — it explains concepts inline so beginner investors understand *why*, not just *what*. Every recommendation comes with reasoning the user can learn from.

All users are based in Israel. The agent tailors recommendations to Israeli investors: Irish-domiciled accumulating ETFs for tax efficiency, Israeli brokerages (Meitav, IBI, Excellence) vs Interactive Brokers, קרנות מחקות for local exposure, and shekel-denominated amounts.

---

## Agent Behavior Principles

- The agent asks only for gaps — no fixed checklist. Detailed input skips clarification entirely.
- The agent does the research; steps are human actions only. "Research VGT vs QQQ" is never a step — the agent searches, synthesizes, and produces specific opinionated recommendations.

---

## Story 1: The happy path — complete beginner

**Goal:** "I have ₪55,000 and I want to start investing but I have no idea where to begin"

**Stage 1 — Clarify:** The agent identifies gaps (age, timeline, risk, emergency fund, debt, monthly contribution, brokerage) and asks in a single message. The user answers with a 20-year horizon and stress-but-hold risk response, which the agent maps to moderate. Because no investment preferences were stated, the agent asks the portfolio defaults question: equity allocation options with compound projections, plus a קרן כספית suggestion for the buffer. The user picks 70% FTSE All-World + 30% TLV-125 with קרן כספית. Stage completes.

**Stage 2 — Research:** Searches covering Irish accumulating ETFs and money market funds. The agent explains the Irish ETF tax advantage (15% vs 25% dividend withholding) and recommends VWRA for the equity portion. Brokerage data (Meitav, IBI, Excellence) is hardcoded — not searched.

**Stage 3 — Plan:** Three-phase plan: open Meitav account, buy ₪44,000 VWRA + ₪11,000 קרן כספית, set up ₪1,800/mo standing order with 80/20 allocation. Target allocation: 80% equity / 20% קרן כספית.

**Stage 4 — Iterate:** User says "looks good." Agent persists the plan and ends the session.

---

## Story 2: Out-of-scope goal — stock redirect

**Goal:** "Should I buy NVIDIA stock?"

**Stage 1 — Clarify (intake):** The agent classifies the goal as `out_of_scope`. It delivers a redirect-only message first (no data-collection questions in the same turn): buying a single stock concentrates all risk in one company, whereas a diversified ETF spreads that risk across hundreds. Offers a sector ETF as a middle ground if the user has a sector preference.

**User accepts the ETF approach.** Field collection begins, chaining from the intake response. The agent asks for remaining gaps and builds a full profile. The goal is restated in ETF terms.

**Stages 2–4 proceed normally.**

---

## Story 3: Unrealistic expectations — reality check redirect

**Goal:** "I have ₪18,000 and I want to double it in 6 months"

**Stage 1 — Clarify (intake):** The agent classifies the goal as `unrealistic`. It delivers a redirect-only message: doubling capital in 6 months requires ~100% returns, which is not achievable with passive ETF investing — even aggressive ETFs return ~15–18%/yr on average. Asks if the user would like to proceed with a realistic long-term plan instead.

**User accepts.** Field collection begins, chaining from the intake response. The user pivots to a 10–15 year horizon. The agent asks for remaining gaps and builds a full profile.

**Stages 2–4 proceed normally.**

---

## Story 4: Contradictory goal — risk resolution

**Goal:** "I want maximum returns but I can't afford to lose any money"

**Stage 1 — Clarify (intake):** The agent classifies the goal as `contradictory` — maximum returns and capital safety are fundamentally incompatible. It presents a concrete loss scenario to surface real risk tolerance: "If your portfolio dropped 20% in a year — say ₪18,000 became ₪14,400 — would you (A) sell to stop further losses, (B) hold and wait for recovery, or (C) buy more while prices are low?" The user answers B. The agent maps this to `moderate` and responds "Got it."

*Note: this intake handles contradictions stated upfront in the initial goal. Mid-conversation contradictions that emerge while answering the risk question are handled inline by the fields phase (CLARIFY_RULES #3).*

**Field collection begins**, chaining from the intake response. Risk tolerance is already resolved — the fields phase does not re-ask it.

**Stages 2–4 proceed normally.**

---

## Story 5: User rejects intake redirect

Applies to any of the three intake classifications (`out_of_scope`, `unrealistic`, `contradictory`).

**Goal:** "Should I buy NVIDIA stock?"

**Stage 1 — Clarify (intake):** The agent classifies the goal as `out_of_scope` and delivers the ETF redirect.

**User declines:** "No, I only want NVIDIA, not interested in ETFs at all."

The agent sends a classification-specific closing message: "No problem — feel free to come back when you're ready to explore ETF-based investing." No profile is produced and the pipeline ends immediately.

*The same pattern applies to `unrealistic` and `contradictory` rejections — each has its own closing message tailored to the classification.*

---

## Story 6: Simple adjustment — no re-research needed

**Goal:** "I'm 35, ₪75,000, moderate risk, long-term retirement savings"

**Stage 1 — Clarify:** The user provides amount, age, risk, and goal in the initial message. The agent asks only for gaps: emergency fund, debt, monthly contribution, brokerage, and timeline specifics. Stage completes.

**Stage 2 — Research:** Searches for Irish accumulating ETFs and money market funds. Returns a 3-fund allocation (global equities, bond fund, money market). Brokerage data is hardcoded — not searched. Stage completes.

**Stage 3 — Plan:** Produces a 3-fund plan with phased steps. Stage completes.

**Stage 4 — Iterate:** The user requests "100% equity, skip bonds entirely." The agent warns about increased volatility, then resolves the change entirely from existing research — no new searches needed. Removes the bond fund and redistributes to equity positions. This is a pure `adjust` — existing research covers the updated portfolio.

---

## Story 7: User pushes back — iteration with re-research

**Goal:** "Invest ₪35,000, I'm 25, aggressive risk tolerance"

**Stage 1 — Clarify:** The user provides amount, age, and risk in the goal. The agent asks for remaining gaps: timeline, emergency fund, debt, monthly contribution, brokerage. Stage completes.

**Stage 2 — Research:** Runs searches for an aggressive ETF allocation. Returns VWRA (60% global equities), EIMI (30% emerging markets), SXRV (10% tech/automation). Stage completes.

**Stage 3 — Plan:** Produces an aggressive 3-ETF plan with phased steps. Stage completes.

**Stage 4 — Iterate:** The user requests "no emerging markets, more tech." This invalidates the EIMI research — the agent runs a new search for tech ETFs, drops EIMI, and adds IUIT alongside SXRV. A risk warning about ~60% tech concentration is included. This is a `research_and_adjust` — the user's change requires new search data the agent doesn't have. The same applies to a risk tolerance shift (aggressive → moderate): the entire portfolio structure changes, triggering `research_and_adjust` rather than a simple `adjust`.

---

## Story 8: Iteration limit reached (pipeline-wide)

After 5 iterations — a mix of `adjust` and `research_and_adjust` — the user requests another sector change. The agent presents the current plan as final: "We've been through several rounds — here's your current plan. You can start a new session anytime." The plan was already persisted from iteration 4's `plan_complete`, so nothing is lost.

**Rule:** Max 5 iterations → present current plan as final → nothing is lost (incremental persistence).

---

## Story 9: Search failure — pipeline hard stop (pipeline-wide)

The user goes through clarification normally, but Stage 2's search API is down. The stage retries 3 times with exponential backoff, all fail. The pipeline stops at the code level — Stage 3 never runs. Error message: "I wasn't able to retrieve current financial data right now. I don't want to build a plan without verified information." No plan is persisted.

**Rule:** Search failure → hard stop. This is a code-level gate, not an LLM decision — no prompt injection can bypass it.
