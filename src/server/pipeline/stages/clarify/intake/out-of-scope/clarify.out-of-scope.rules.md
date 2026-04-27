# Clarify Out-of-Scope Intake — Behavior Rules

Behavioral rules for the out-of-scope intake handler. Each entry: the rule, a one-line scenario, and the expected outcome.

---

## 1. Agent explains the risk of the request and offers a fitting ETF alternative; no field collection

**Rule:** The agent explains the specific risk of the user's request and offers an appropriate ETF alternative — concentration risk + sector ETF for stock picking, market-timing difficulty + index ETF for day trading, custody/volatility risk + crypto ETF for direct crypto. Closes with a direct question asking if the user wants to proceed with an ETF plan. No profile or data collection questions are asked in this phase.

**Scenario:** "Should I buy NVIDIA stock?" → agent explains concentration risk, offers NASDAQ-100, asks if user wants to proceed with an ETF-based approach.

---

## 2. User accepts → extraction returns `{ accepted: true, alignedGoal }`

**Rule:** When the user agrees to proceed with an ETF-based approach, the post-loop extraction returns `accepted: true` with an `alignedGoal` that preserves the user's directional preference (e.g., tech exposure) expressed through an ETF.

**Scenario:** User says "ok fine, I'm open to ETFs" → `{ accepted: true, alignedGoal: "Invest in a tech ETF (e.g., NASDAQ-100) rather than individual stocks" }`

---

## 3. User declines → extraction returns `{ accepted: false }`

**Rule:** When the user explicitly refuses to switch to ETFs or insists on their original request, the extraction returns `accepted: false`. The orchestrator sends the per-classification rejection message and ends the session.

**Scenario:** User says "No, I only want NVIDIA, not interested in ETFs" → `{ accepted: false }`
