# Clarify Amount Phase — Behavior Rules

Behavioral rules for the amount collection phase. Each entry: the rule, a one-line scenario, and the fields that matter for verifying correctness.

---

## 1. Amount: collected as integer in shekels (with normalization); ends unresolved after two failed attempts

**Normalization:** The agent normalizes informal numeric notation to an integer in shekels — k-notation ("50k" → 50000), spelled numbers ("30 thousand" → 30000), and currency symbols/separators ("₪50,000" → 50000).

**Failure mode:** If the user fails to provide a specific amount after two attempts, the phase ends immediately — no further questions are asked.

**Scenario:** User says "I'm not sure" on first ask, "I really don't know" on retry. Agent stops.

**Extracted:** `{ status: "unresolved", reason: "amount" }`

---

## 2. Deflection or off-topic response → redirect back

**Rule:** If the user deflects (e.g., "skip", "I don't want to answer") or goes off-topic on the amount question, the agent redirects them back to answer it.

**Scenario:** Agent has asked for the amount; user responds "skip".

**Expected behavior:** Agent redirects the user back to provide a specific amount in shekels.

---

## 3. User asks a clarifying question → brief educational answer, then re-ask

**Rule:** If the user asks a question instead of answering (e.g., "why do you need to know?"), the agent answers briefly with a concrete educational reason tied to the user's investing context, then re-asks for the amount. Counts toward the two-try budget.

**Scenario:** Agent has asked for the amount; user responds "why do you need to know?"

**Expected behavior:** Agent gives a 1-sentence educational reason (e.g., "I need the amount to build your investment plan") then asks for the amount again.
