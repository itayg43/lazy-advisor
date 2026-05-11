# Clarify Parameters Phase — Behavior Rules

Behavioral rules for the parameters collection phase. Each entry: the rule, a one-line scenario, and the fields that matter for verifying correctness.

---

## 1. Parameters are collected in two structured turns

**Rule:** The agent always asks one parameter per turn: amount first, then timeline. The two questions are always kept separate.

**Scenario:** All parameters unknown — agent asks for amount; user answers; agent then asks for timeline (presenting four bucket options); user picks a bucket.

**Extracted:** `amount` and `timeline` collected in two turns

---

## 2. Timeline asked twice with no valid answer → phase ends with failure

**Rule:** If the timeline has been asked twice without a specific, mappable timeframe, the phase ends with `timeline_missing` — same two-try rule as amount. A valid second response (e.g., "around 10 years or so") is still mapped and accepted; null is only returned when both responses are genuinely unmappable (e.g., "I don't know", "someday").

**Scenario:** User says "I don't know" on first ask, "I really can't say" on retry. Agent stops without proceeding.

**Extracted:** `{ status: "unresolved", reason: "timeline" }`

---

## 3. Timeline is collected as one of four named buckets; agent presents choices when asking

**Rule:** When asking for timeline, the agent always presents the four investment horizon buckets as options. Any stated timeframe is mapped to the nearest bucket at extraction time.

**Boundary mapping:** When a stated number lands exactly on a bucket boundary, map to the shorter bucket. This aligns with the conservative bias that collapses all risk tolerances to 0–10% equity for short horizons — capital safety takes precedence over growth potential when the horizon is ambiguous.
- `"3 years"` → `"under 3 years"`
- `"5 years"` → `"3–5 years"`
- `"10 years"` → `"5–10 years"`

**Scenario:** All parameters unknown — agent opens by asking for amount; user answers; agent then asks for timeline (presenting four bucket options); user picks a timeline bucket.

**Extracted:** timeline: one of the four enum values

---

## 4. Amount asked twice with no valid number → phase ends with failure

**Rule:** If the user fails to provide a specific amount after two attempts, the phase ends immediately — timeline is not asked. Timeline follows the same two-try rule (see rule 2).

**Scenario:** User says "I'm not sure" on first ask, "I really don't know" on retry. Agent stops without asking for timeline.

**Extracted:** `{ status: "unresolved", reason: "amount" }`

---

## 5. Deflection or off-topic response → redirect back

**Rule:** If the user deflects (e.g., "skip", "I don't want to answer") or goes off-topic on either the amount or timeline question, the agent redirects them back to answer the current question. Applies to both questions.

**Scenario:** Agent has asked for timeline; user responds "skip".

**Expected behavior:** Agent redirects the user back to pick one of the four timeline options.
