# Clarify Parameters Phase — Behavior Rules

Behavioral rules for the parameters collection phase. Each entry: the rule, a one-line scenario, and the fields that matter for verifying correctness.

---

## 1. Amount: collected as integer in shekels (with normalization); ends unresolved after two failed attempts

**Normalization:** The agent normalizes informal numeric notation to an integer in shekels — k-notation ("50k" → 50000), spelled numbers ("30 thousand" → 30000), and currency symbols/separators ("₪50,000" → 50000).

**Failure mode:** If the user fails to provide a specific amount after two attempts, the phase ends immediately — timeline is not asked.

**Scenario:** User says "I'm not sure" on first ask, "I really don't know" on retry. Agent stops without asking for timeline.

**Extracted:** `{ status: "unresolved", reason: "amount" }`

---

## 2. Timeline: collected as one of four named buckets (with mapping); ends unresolved after two failed attempts

**Bucket presentation and mapping:** When asking for timeline, the agent always presents the four investment horizon buckets as options. Any stated timeframe is mapped to the nearest bucket at extraction time, including approximate phrasings like "about 20 years" or "around 10".

**Boundary rule:** When a stated number lands exactly on a bucket boundary, map to the shorter bucket. This is the conservative direction: rounding `"3 years"` down to `"under 3 years"` triggers the short-horizon early halt (money market fund redirect) rather than the allocation table, and rounding other boundaries down lands the user in the lower-equity cell — capital safety takes precedence when the horizon is ambiguous.
- `"3 years"` → `"under 3 years"`
- `"5 years"` → `"3–5 years"`
- `"10 years"` → `"5–10 years"`

**Failure mode:** If the timeline has been asked twice without a specific, mappable timeframe, the phase ends with reason `timeline`. A valid second response (e.g., "around 10 years or so") is still mapped and accepted; null is only returned when both responses are genuinely unmappable (e.g., "I don't know", "someday").

**Scenario:** User says "I don't know" on first ask, "I really can't say" on retry. Agent stops without proceeding.

**Extracted:** `{ status: "unresolved", reason: "timeline" }`

---

## 3. Deflection or off-topic response → redirect back

**Rule:** If the user deflects (e.g., "skip", "I don't want to answer") or goes off-topic on either the amount or timeline question, the agent redirects them back to answer the current question. Applies to both questions.

**Scenario:** Agent has asked for timeline; user responds "skip".

**Expected behavior:** Agent redirects the user back to pick one of the four timeline options.

---

## 4. User asks a clarifying question → brief educational answer, then re-ask

**Rule:** If the user asks a question instead of answering (e.g., "why do you need to know?", "why does this matter?"), the agent answers briefly with a concrete educational reason tied to the user's investing context, then re-asks the parameter question. Counts toward the two-try budget.

**Scenario:** Agent has asked for timeline; user responds "why does this matter?"

**Expected behavior:** Agent gives a 1-sentence educational reason (e.g., "Your timeline determines how much risk your portfolio can absorb") then asks for the timeline again.
