# Clarify Fields Phase — Behavior Rules

Behavioral rules for the fields collection phase. Each entry: the rule, a one-line scenario, and the fields that matter for verifying correctness.

---

## 1. Fields are collected in two structured turns

**Rule:** The agent always opens by asking for amount, age, and timeline together (turn 1), then asks hasEmergencyFund and hasDebt together in a single follow-up (turn 2). The two groups are always kept separate — financial health questions are never mixed into the first turn.

**Scenario:** All fields unknown — turn 1 asks amount, age, timeline; turn 2 asks hasEmergencyFund and hasDebt together.

**Extracted:** all fields collected across two turns

---

## 2. Vague timeline → accepted after second ask

**Rule:** If a field has been asked twice without a specific value, accept the best available answer and move on — do not probe a third time.

**Scenario:** User says "long-term" on first response, "10-15 years" on second.

**Extracted:** timeline: "10+ years" (mapped from "10-15 years")

---

## 3. Timeline is collected as one of four named buckets; agent presents choices when asking

**Rule:** When asking for timeline, the agent always presents the four investment horizon buckets as options. Any stated timeframe is mapped to the nearest bucket at extraction time.

**Boundary mapping:** When a stated number lands exactly on a bucket boundary, map to the shorter bucket. This aligns with the conservative bias that collapses all risk tolerances to 0–10% equity for short horizons — capital safety takes precedence over growth potential when the horizon is ambiguous.
- `"3 years"` → `"under 3 years"`
- `"5 years"` → `"3–5 years"`
- `"10 years"` → `"5–10 years"`

**Scenario:** All fields unknown — agent opens by asking for amount, age, timeline (presenting four bucket options); user picks a timeline bucket.

**Extracted:** timeline: one of the four enum values
