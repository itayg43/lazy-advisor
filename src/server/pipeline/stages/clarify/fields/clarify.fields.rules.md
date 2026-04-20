# Clarify Fields Phase — Behavior Rules

Behavioral rules for the fields collection phase. Each entry: the rule, a one-line scenario, and the fields that matter for verifying correctness.

---

## 1. All fields complete on first message → no asks

**Rule:** If all required fields are present and valid in the user's initial message, the phase ends immediately — no `ask_user` call is made.

**Scenario:** "I'm 24, ₪18,000, 10 years, yes emergency fund, no debt."

**Extracted:** amount: 18000 | age: 24 | timeline: "10 years" | hasEmergencyFund: true | hasDebt: false

---

## 2. Rich initial goal → agent asks only for gaps

**Rule:** The agent asks only for gaps — fields already stated in the goal (amount, age, context) are not re-asked. If the goal provides enough to infer a field, treat it as answered.

**Scenario:** "I'm 35, ₪75,000, long-term retirement savings" — only gaps (emergency fund, debt, timeline) are asked.

**Extracted:** amount: 75000 | age: 35 | timeline: ~30 years, retirement at 65

---

## 3. Multiple fields missing → batched, most critical first

**Rule:** When several fields are missing, ask the most critical ones first (amount, age, timeline) — at most 4 questions per turn. Remaining fields are collected in the next turn.

**Scenario:** "I want to start investing." — amount, age, timeline, hasEmergencyFund, hasDebt are all missing. First turn asks the 4 most critical; second turn asks the rest.

**Extracted:** all fields collected across two turns

---

## 4. Vague timeline → accepted after second ask

**Rule:** If a field has been asked twice without a specific value, accept the best available answer and move on — do not probe a third time.

**Scenario:** "I want to invest" — user says "long-term" on first response, "10-15 years" on second.

**Extracted:** amount: 20000 | age: 32 | timeline: "10-15 years"
