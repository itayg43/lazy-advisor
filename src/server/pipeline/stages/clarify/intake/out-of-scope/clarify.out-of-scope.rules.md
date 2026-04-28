# Clarify Out-of-Scope Intake — Behavior Rules

Behavioral rules for the out-of-scope intake handler. Each entry: the rule, a one-line scenario, and the expected outcome.

---

## 1. Agent explains the risk of the request and offers an ETF alternative; no field collection, no specific tickers

**Rule:** The agent explains the specific risk of the user's request and offers an ETF alternative — concentration risk + diversified ETF for stock picking, market-timing difficulty + index ETF for day trading, custody/volatility risk + regulated crypto ETF for direct crypto. The agent does not name specific tickers or fund names — fund selection is handled in later phases. When applicable, the explanation references the user's specific stock or asset by name (e.g., NVIDIA, Bitcoin) to ground the example. Closes with a direct question asking if the user wants to proceed with an ETF plan. No profile or data collection questions are asked in this phase.

**Scenario:** "Should I buy NVIDIA stock?" → agent explains concentration risk using NVIDIA by name, offers a diversified ETF (no ticker), asks if user wants to proceed with an ETF-based approach.

---

## 2. User accepts → extraction returns `{ accepted: true }`

**Rule:** When the user agrees to proceed with an ETF-based approach — including hesitant or reluctant agreement and qualifiers like "fine", "sure", "I guess", or "I'll try" — the post-loop extraction returns `{ accepted: true }`.

**Scenario:** User says "ok fine, I'm open to ETFs" → `{ accepted: true }`. Reluctant: "I guess I'll try ETFs" → `{ accepted: true }`.

---

## 3. User declines → extraction returns `{ accepted: false }`

**Rule:** When the user explicitly refuses to switch to ETFs or insists on their original request, the extraction returns `accepted: false`. The orchestrator sends the per-classification rejection message and ends the session.

**Scenario:** User says "No, I only want NVIDIA, not interested in ETFs" → `{ accepted: false }`

---

## 4. User asks a clarifying question → agent answers briefly and re-asks

**Rule:** When the user asks a clarifying question (e.g., "what's an ETF?", "why can't I just buy the stock?") instead of accepting or rejecting, the agent answers in one or two educational sentences, notes that specifics will be covered later, and re-asks whether the user wants to proceed with an ETF-based plan. No profile or data collection questions are asked here. The user's response to the re-ask determines acceptance per rules 2 and 3.

**Scenario:** Agent redirects → user asks "what's an ETF?" → agent answers briefly and re-asks → user accepts → `{ accepted: true }`.

---

## 5. Mixed ETF + stock picking goal → acknowledge ETF interest, redirect stock-picking component

**Rule:** When the user's goal mixes ETF investing with individual stock picking (e.g., "I want ETFs but also buy some NVIDIA"), the agent acknowledges the ETF interest positively and addresses only the stock component: explains concentration risk using the user's specific stock by name, offers a sector ETF as an alternative (no ticker named). Closes with a question asking if the user wants to proceed with a pure ETF plan.

**Scenario:** "I want to invest in ETFs but also buy some NVIDIA stock" → agent acknowledges ETF interest, explains NVIDIA concentration risk, offers sector ETF alternative (no ticker), asks if user wants a pure ETF approach.
