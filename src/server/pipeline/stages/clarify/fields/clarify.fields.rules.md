# Clarify Fields Phase — Behavior Rules

Behavioral rules for the fields collection phase. Each entry: the rule, a one-line scenario, and the fields that matter for verifying correctness.

---

## 1. Partial context in initial goal → agent asks only for gaps

**Rule:** The agent asks only for gaps — fields already stated in the goal (amount, age, context) are not re-asked. If the goal provides enough to infer a field, treat it as answered.

**Scenario:** "I'm 35, ₪75,000, long-term retirement savings" — only gaps (emergency fund, debt, timeline) are asked.

**Extracted:** amount: 75000 | age: 35 | timeline: "10+ years"

---

## 2. Multiple fields missing → batched, most critical first

**Rule:** When several fields are missing, ask the most critical ones first (amount, age, timeline) — at most 4 questions per turn. Remaining fields are collected in the next turn.

**Scenario:** "I want to start investing." — amount, age, timeline, hasEmergencyFund, hasDebt are all missing. First turn asks the 4 most critical; second turn asks the rest.

**Extracted:** all fields collected across two turns

---

## 3. Vague timeline → accepted after second ask

**Rule:** If a field has been asked twice without a specific value, accept the best available answer and move on — do not probe a third time.

**Scenario:** "I want to invest" — user says "long-term" on first response, "10-15 years" on second.

**Extracted:** amount: 20000 | age: 32 | timeline: "10+ years" (mapped from "10-15 years")

---

## 4. Timeline is collected as one of four named buckets; agent presents choices when asking

**Rule:** When asking for timeline, the agent always presents the four investment horizon buckets as options. Any stated timeframe is mapped to the nearest bucket at extraction time.

**Scenario:** "I want to invest ₪50,000, I'm 25" — agent presents the four bucket options; user picks one.

**Extracted:** timeline: one of the four enum values
