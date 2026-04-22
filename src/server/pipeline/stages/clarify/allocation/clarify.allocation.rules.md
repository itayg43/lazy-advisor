# Clarify Allocation Phase — Behavior Rules

Behavioral rules for the allocation phase. This phase converts the user's risk-tolerance bucket (from the risk phase) and timeline (from the fields phase) into a **total-portfolio split** between two buckets: equity (stocks / stock ETFs) and buffer (cash, money-market funds, short-term bonds). Output is two integers summing to 100.

This phase does **not** pick instruments. Ticker selection belongs to Phase 5a (equity) and Phase 5b (buffer).

## Anchor Table (risk tolerance × timeline)

| Willingness \ Timeline | < 3 yr | 3–5 yr | 5–10 yr | 10+ yr |
|---|---|---|---|---|
| `conservative` | 0–10% | 10–20% | 30–40% | 40–50% |
| `moderate`     | 0–10% | 20–30% | 50–60% | 60–70% |
| `aggressive`   | 0–10% | 30–40% | 60–70% | 80–90% |

Cells are **ranges**, not points. The agent picks a specific integer inside the cell based on qualitative signal (where the user sits within their risk bucket, how clean the timeline is). Buffer percentage is always `100 - equity`.

The `<3yr` column is 0–10% across all rows on purpose. Money needed in under 3 years is dominated by the need for it to still be there — risk tolerance is not a meaningful dial at that horizon per Vanguard, Fidelity, Bogleheads. The user can still push back; see Rule 3.

Internal risk labels (`conservative`, `moderate`, `aggressive`) are **never shown to the user**.

## Design constraints

- **Point-estimate, not distribution.** Output is a single integer (e.g., 70), not a range. Acceptable for a behavioral anchor; not acceptable as portfolio-optimization output.
- **"Sizing tends to reduce panic-selling" — directional, not absolute.** Use "tends to reduce"; never "prevents" or "eliminates". Aligned with Kitces's composure-vs-tolerance distinction.
- **3-bucket willingness input is coarser than industry norm.** Vanguard uses 9 anchors, Fidelity 7. Our 3-bucket output from the risk phase compresses into a 3×4 table. If evals surface discrimination problems, `RiskPhaseOutput.selfRatingScore` is available to refine without changing the risk phase.

---

## 1. Propose the cell-appropriate anchor

**Rule:** On entry, send one `ask_user` call that proposes a specific split based on the user's risk tolerance × timeline cell. The proposal must include:

- The split in **shekels** against the user's investment amount (e.g., "₪35,000 in stock ETFs and ₪15,000 in a buffer — roughly 70/30"). Not percentage-only. The two shekel amounts **must sum to exactly the user's investment amount** — the prompt instructs the model to compute `amount × percentage ÷ 100` for equity and `amount − equity shekels` for buffer, verifying the sum before sending.
- One honest trade-off sentence **in relative terms**: more equity → bigger drops in bad years + higher long-run growth; less equity → smaller drops + lower growth. **No specific drawdown percentages in this turn** — they age badly and invite false precision.
- The behavioral framing: "sizing to your comfort level **tends to reduce** the chance of panic-selling when drops happen." Never "prevents" or "eliminates".
- A question asking whether the user wants that split, more in stocks, or more in buffer.

**Scenarios:**
- Aggressive, 10+ yr, ₪50,000 → propose ~85/15 (inside 80–90% cell).
- Moderate, 5–10 yr, ₪80,000 → propose ~55/45 (inside 50–60% cell).
- Conservative, 3–5 yr, ₪30,000 → propose ~15/85 (inside 10–20% cell).
- Any risk, <3 yr, ₪20,000 → propose ~5/95 (inside 0–10% cell — short-horizon collapse).

---

## 2. User accepts → end the phase

**Rule:** If the user replies with a clear yes ("sounds good", "ok", "yes", "let's do it") to the Rule 1 proposal, stop calling tools. No wrap-up message, no re-confirmation.

---

## 3. User proposes a different split → honor the exact number, with an extreme-mismatch exception

**Rule:** If the user counter-proposes a different split (any direction, any size), honor the user's **exact number** — do not snap to the cell edge. In the same `ask_user` call: confirm the updated split in shekels and percent, include one directional trade-off sentence (more equity → bigger drops / higher growth; less equity → smaller drops / lower growth), end on acceptance.

**Why exact-number, not snap-to-cell:** haggling with the user undermines the "user has final say" principle. The sanity check below is our guardrail for the extreme end.

**Exception — extreme mismatch.** If the user's proposed split is significantly outside the cell range for their profile, surface the mismatch **once** with honest framing instead of the plain trade-off note, then accept the user's final answer. Do **not** re-challenge.

In the sanity-check turn, **concrete drawdown percentages are allowed** — the whole point is to convey seriousness. Outside the sanity check, percentages are not used.

**Scenarios:**
- Proposal 85/15 (aggressive, 10+ yr). User: "Make it 82." → honor exactly, trade-off note, end. Extract 82/18.
- Proposal 85/15. User: "Make it 77." → honor exactly (below cell edge but not extreme), trade-off note, end. Extract 77/23.
- Proposal 85/15. User: "Make it 50/50." → honor, trade-off note (smaller drops, lower growth), end. Extract 50/50.
- Proposal 45/55 (conservative, 10+ yr). User: "Make it 100%." → sanity check: "Your earlier answer suggested you're uncomfortable with big drops — going 100% stocks could mean watching 30–50% of your portfolio disappear in a bad year. Still want to go there?" User: "Yes." → extract 100/0.
- Proposal 5/95 (moderate, <3 yr). User: "Make it all stocks." → sanity check: "Money you need in under 3 years usually isn't invested in stocks — a 30% drop right before you need it is hard to recover from. Still want to go that way?" User: "Yes." → extract 100/0.

**What counts as extreme** is a qualitative judgment: the proposed split is far enough from the cell anchor that the mismatch with the user's stated profile is obvious. Examples: conservative asking for 100% stocks, short-horizon asking for all equity, aggressive 10+ yr asking for 0% equity. Trust model judgment on the grey cases — evals will catch drift.

---

## 4. User asks a clarifying question → explain briefly, then re-ask

**Rule:** If the user replies to the Rule 1 proposal with a question instead of an answer, answer briefly and honestly, then re-present the same anchor question in the same `ask_user` call.

**Explanation scope:**
- **Concept questions** (what equity is, what a buffer is for, why split at all, what a money-market fund / קרן כספית is): answer in one or two sentences.
- **Method questions** ("how did you come up with 70/30?"): name the two inputs — investment timeline and comfort with drops — and note the split reflects both. Do **not** mention internal risk labels or show the anchor table.
- **Instrument questions** ("which ETF?", "which money-market fund?"): say that's the next step after we settle on the split, and bring the conversation back to sizing.

**Scenarios:**
- "What's a buffer?" → "A buffer is the portion of your portfolio held in something stable like cash, a money-market fund, or short-term bonds. It smooths volatility and acts as a cushion when stocks drop." → re-ask.
- "How did you get to 70/30?" → "Two inputs: your investment timeline and your comfort with drops. A longer horizon and higher comfort shift toward more stocks; the 70/30 reflects both." → re-ask.
- "Which ETF should I buy?" → "That's the next step after we settle on the overall split. For now — does 70/30 sound right, or more/less in stocks?" (the re-ask is the deflection).

---

## Tool-call budget

`MAX_ALLOCATION_TOOL_CALLS = 5`. Typical path:

- **Happy path:** 1 proposal + user accepts = 1 tool call.
- **Counter-proposal path:** 1 proposal + 1 counter-proposal confirm = 2 tool calls.
- **Clarifying question path:** 1 proposal + 1 explanation + re-ask + 1 final confirm = 3 tool calls.
- **Sanity-check path:** 1 proposal + 1 extreme counter-proposal sanity check + 1 final confirm = 3 tool calls.
- **Worst case** (clarifying question followed by extreme counter-proposal) = 4 tool calls, still within budget.

## Extraction fallback

If the phase loop exhausts `MAX_ALLOCATION_TOOL_CALLS` without reaching an agreed split, the extraction step is called anyway with `previous_response_id` chaining — same pattern as the risk phase. There is **no safe default** for allocation (unlike risk's "default to conservative when willingness is unknown"), so if extraction returns something non-sensible, the `AllocationPhaseOutputSchema.refine()` check (`equityPercentage + bufferPercentage === 100`) will fail and throw. Guessing a default would override user intent.

## Out of scope

- **Instrument selection.** If the user asks "which ETF?" or "which money-market fund?", deflect to later phases (Phase 5a equity / Phase 5b buffer) and bring the conversation back to sizing.
- **EF / debt suitability gating.** `hasEmergencyFund` and `hasDebt` are collected upstream but this phase does not consume them. Whether to treat them as a stage-level suitability gate is a separate Phase 7 decision tracked in `STATUS.md`.
- **Emitting to `UserProfile`.** Phase 6 (thin extraction) flattens `AllocationPhaseOutput.equityPercentage` and `.bufferPercentage` onto `UserProfile`.
