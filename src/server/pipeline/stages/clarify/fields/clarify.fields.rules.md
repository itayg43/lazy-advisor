# Clarify Fields Phase — Behavior Rules

Behavioral rules for the fields collection phase. Each entry: the rule, a one-line scenario, and the fields that matter for verifying correctness.

---

## 1. Vague timeline → accepted after second ask

**Rule:** If a field has been asked twice without a specific value, accept the best available answer and move on — do not probe a third time.

**Scenario:** "I want to invest" — user says "long-term" on first response, "10-15 years" on second.

**Extracted:** amount: 20000 | age: 32 | timeline: "10-15 years"

---

## 2. Rich initial goal → agent asks only for gaps

**Rule:** The agent asks only for gaps — fields already stated in the goal (amount, age, context) are not re-asked. If the goal provides enough to infer a field, treat it as answered.

**Scenario:** "I'm 35, ₪75,000, moderate risk, long-term retirement savings" — only gaps (emergency fund, debt, timeline, monthly contribution) are asked.

**Extracted:** amount: 75000 | age: 35 | timeline: ~30 years, retirement at 65

---

## 3. monthlyContribution: 0 is a valid answer — vague then default

**Rule:** On the second ask for monthly contribution with no specific value, append "If you're not planning to contribute monthly, ₪0 is a valid answer." After two asks with no specific value, accept `0`.

**Scenario:** User says "whatever I can" on first ask, gives no specific amount on second ask.

**Extracted:** monthlyContribution: 0

---

## 4. monthlyContribution: 0 stated upfront → accepted immediately

**Rule:** If the user explicitly states they have no monthly contribution (e.g. "I'm not planning to add monthly" or "₪0"), accept `0` without a follow-up ask — do not prompt for a specific amount.

**Scenario:** "I have ₪40,000, I'm 28, 15 years, yes emergency fund, no debt, I'm not planning to contribute monthly."

**Extracted:** monthlyContribution: 0

---

## 5. All fields complete on first message → no asks

**Rule:** If all required fields are present and valid in the user's initial message, the phase ends immediately — no `ask_user` call is made.

**Scenario:** "I'm 24, ₪18,000, 10 years, yes emergency fund, no debt, ₪700/month."

**Extracted:** amount: 18000 | age: 24 | timeline: "10 years" | hasEmergencyFund: true | hasDebt: false | monthlyContribution: 700

---

## 6. Multiple fields missing → batched, most critical first

**Rule:** When several fields are missing, ask the most critical ones first (amount, age, timeline) — at most 4 questions per turn. Remaining fields are collected in the next turn.

**Scenario:** "I want to start investing." — amount, age, timeline, hasEmergencyFund, hasDebt, and monthlyContribution are all missing. First turn asks the 4 most critical; second turn asks the rest.

**Extracted:** all fields collected across two turns
