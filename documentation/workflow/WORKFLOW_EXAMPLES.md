# Lazy Advisor — Usage Stories

Realistic scenarios showing how the CLI works in practice. MVP scope: single sessions with plan persistence, no cross-session memory.

The agent is **educational by default** — it explains concepts inline so beginner investors understand *why*, not just *what*. Every recommendation comes with reasoning the user can learn from.

All users are based in Israel. The agent tailors recommendations to Israeli investors: Irish-domiciled accumulating ETFs for tax efficiency, Israeli brokerages (Meitav, IBI) vs Interactive Brokers, קרנות מחקות for local exposure, and shekel-denominated amounts.

---

## Agent Behavior Principles

- The agent asks only for gaps — no fixed checklist. Detailed input skips clarification entirely.
- The agent does the research; steps are human actions only. "Research VGT vs QQQ" is never a step — the agent searches, synthesizes, and produces specific opinionated recommendations.

---

## Story 1: The happy path — complete beginner

**Goal:** "I have ₪55,000 and I want to start investing but I have no idea where to begin"

**Stage 1 — Clarify:** The agent identifies gaps (age, timeline, risk, emergency fund, debt, monthly contribution, brokerage) and asks in a single message. The user answers with a 20-year horizon and stress-but-hold risk response, which the agent maps to moderate. Because no investment preferences were stated, the agent asks the portfolio defaults question: equity allocation options with compound projections, plus a קרן כספית suggestion for the buffer. The user picks 70% FTSE All-World + 30% TLV-125 with קרן כספית. Stage completes.

**Stage 2 — Research:** Four searches covering Irish accumulating ETFs, Israeli brokerage fees, and money market funds. The agent explains the Irish ETF tax advantage (15% vs 25% dividend withholding) and recommends VWRA for the equity portion.

**Stage 3 — Plan:** Three-phase plan: open Meitav account, buy ₪44,000 VWRA + ₪11,000 קרן כספית, set up ₪1,800/mo standing order with 80/20 allocation. Target allocation: 80% equity / 20% קרן כספית.

**Stage 4 — Iterate:** User says "looks good." Agent persists the plan and ends the session.

---

## Story 2: Simple adjustment — no re-research needed

**Goal:** "I'm 35, ₪75,000, moderate risk, long-term retirement savings"

**Stage 1 — Clarify:** The user provides amount, age, risk, and goal in the initial message. The agent asks only for gaps: emergency fund, debt, monthly contribution, brokerage, and timeline specifics. Stage completes.

**Stage 2 — Research:** Searches for Irish accumulating ETFs and Israeli brokerages. Returns a 3-fund allocation (global equities, bond fund, money market). Stage completes.

**Stage 3 — Plan:** Produces a 3-fund plan with phased steps. Stage completes.

**Stage 4 — Iterate:** The user requests "100% equity, skip bonds entirely." The agent warns about increased volatility, then resolves the change entirely from existing research — no new searches needed. Removes the bond fund and redistributes to equity positions. This is a pure `adjust` — existing research covers the updated portfolio.

---

## Story 3: User pushes back — iteration with re-research

**Goal:** "Invest ₪35,000, I'm 25, aggressive risk tolerance"

**Stage 1 — Clarify:** The user provides amount, age, and risk in the goal. The agent asks for remaining gaps: timeline, emergency fund, debt, monthly contribution, brokerage. Stage completes.

**Stage 2 — Research:** Runs searches for an aggressive ETF allocation. Returns VWRA (60% global equities), EIMI (30% emerging markets), SXRV (10% tech/automation). Stage completes.

**Stage 3 — Plan:** Produces an aggressive 3-ETF plan with phased steps. Stage completes.

**Stage 4 — Iterate:** The user requests "no emerging markets, more tech." This invalidates the EIMI research — the agent runs a new search for tech ETFs, drops EIMI, and adds IUIT alongside SXRV. A risk warning about ~60% tech concentration is included. This is a `research_and_adjust` — the user's change requires new search data the agent doesn't have. The same applies to a risk tolerance shift (aggressive → moderate): the entire portfolio structure changes, triggering `research_and_adjust` rather than a simple `adjust`.

---

## Story 4: Iteration limit reached (pipeline-wide)

After 5 iterations — a mix of `adjust` and `research_and_adjust` — the user requests another sector change. The agent presents the current plan as final: "We've been through several rounds — here's your current plan. You can start a new session anytime." The plan was already persisted from iteration 4's `plan_complete`, so nothing is lost.

**Rule:** Max 5 iterations → present current plan as final → nothing is lost (incremental persistence).

---

## Story 5: Search failure — pipeline hard stop (pipeline-wide)

The user goes through clarification normally, but Stage 2's search API is down. The stage retries 3 times with exponential backoff, all fail. The pipeline stops at the code level — Stage 3 never runs. Error message: "I wasn't able to retrieve current financial data right now. I don't want to build a plan without verified information." No plan is persisted.

**Rule:** Search failure → hard stop. This is a code-level gate, not an LLM decision — no prompt injection can bypass it.
