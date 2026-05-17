# Clarify Allocation Phase — Behavior Rules

Behavioral rules for the allocation phase. This phase converts the user's risk-tolerance bucket (from the risk phase) and timeline (from the parameters phase) into a **total-portfolio split** between two buckets: equity (stocks / stock ETFs) and buffer (cash, money-market funds, short-term bonds). Output is two integers summing to 100.

This phase does **not** pick instruments. Ticker selection belongs to T5 (equity) and T6 (buffer).

## Anchor Table (risk tolerance × timeline)

| Willingness \ Timeline | 3–5 years | 5–10 years | 10+ years |
| ---------------------- | --------- | ---------- | --------- |
| `conservative`         | 10–20%    | 30–40%     | 40–50%    |
| `moderate`             | 20–30%    | 50–60%     | 60–70%    |
| `aggressive`           | 30–40%    | 60–70%     | 80–90%    |

All cells are **ranges**, not points. The specific equity percentage inside a cell is **precomputed in code** based on the user's `riskSelfRatingScore` (see Rule 1 → Within-bucket discrimination). Buffer percentage is always `100 - equity`.

Users with an `under 3 years` timeline never reach this phase — the orchestrator exits early after parameters collection and redirects them to a money market fund. This phase only receives timelines of `3–5 years`, `5–10 years`, or `10+ years`.

The words `conservative`, `moderate`, and `aggressive` are **never used when speaking to the user** — not even as general adjectives. Internal "cell" terminology is also never exposed to the user; the cell range is referred to as the "recommended range" in user-facing text.

## Design constraints

- **Point-estimate, not distribution.** Output is a single integer (e.g., 70), not a range. Acceptable for a behavioral anchor; not acceptable as portfolio-optimization output.
- **"Sizing tends to reduce panic-selling" — directional, not absolute.** Use "tends to reduce"; never "prevents" or "eliminates". Aligned with Kitces's composure-vs-tolerance distinction.
- **3-bucket willingness input is coarser than industry norm.** Vanguard uses 9 anchors, Fidelity 7. Our 3-bucket output from the risk phase compresses into a 3×4 table, with `RiskPhaseOutput.riskSelfRatingScore` providing within-bucket discrimination so each score lands at a distinct point inside its cell (see Rule 1).

---

## 1. Propose the cell-appropriate anchor

**Rule:** On entry, the equity percentage and shekel amounts are **precomputed in code** (`collectAllocation` in `clarify.allocation.ts`) and passed to the prompt as context. The model sends one `ask_user` call that relays the proposal verbatim — it must not recompute or adjust the numbers. The proposal must include:

- The split in **shekels** against the user's investment amount (e.g., "₪35,000 in stock ETFs and ₪15,000 in a buffer — roughly 70/30"). Not percentage-only.
- One honest trade-off sentence **in relative terms**: more equity → bigger drops in bad years + higher long-run growth; less equity → smaller drops + lower growth. **No specific drawdown percentages in this turn** — they age badly and invite false precision.
- The behavioral framing: "sizing to your comfort level **tends to reduce** the chance of panic-selling when drops happen." Never "prevents" or "eliminates".
- A question asking whether the user wants that split, more in stocks, or more in buffer.

### Within-bucket discrimination

The equity percentage inside a cell is selected by `pickEquityPercentage(cell, riskSelfRatingScore)`:

| `riskSelfRatingScore` | Position in cell | Formula                     |
| --------------------- | ---------------- | --------------------------- |
| 1, 4                  | Low end          | `cell.min + 2`              |
| 2, 5                  | High end         | `cell.max - 2`              |
| 3                     | Midpoint         | `(cell.min + cell.max) / 2` |

The +2/-2 insets keep proposals off cell boundaries. Score 3 hits the midpoint because it's the only score in the moderate risk-tolerance bucket — no within-bucket discrimination is needed.

**Scenarios:**

- Aggressive, 10+ years, ₪50,000, score 5 → 88% equity (cell.max − 2) → propose ₪44,000 / ₪6,000.
- Moderate, 5–10 years, ₪80,000, score 3 → 55% equity (midpoint) → propose ₪44,000 / ₪36,000.
- Conservative, 3–5 years, ₪30,000, score 2 → 18% equity (cell.max − 2) → propose ₪5,400 / ₪24,600.
- Same cell, different score: aggressive 10+ yr, score 4 → 82% equity (cell.min + 2), not 88% (score 5). Score discriminates within the bucket.

---

## 2. User accepts → end the phase

**Rule:** If the user replies with a clear yes (e.g., "sounds good", "ok", "yes", "let's do it") to the **currently proposed split**, stop calling tools. No wrap-up message, no re-confirmation.

**Disambiguation:** A response that names a specific percentage or ratio different from the current proposal — even if phrased as acceptance (e.g., "let's do 50/50", "I want 60%") — is a counter-proposal. Apply Rule 3 instead.

---

## 3. User proposes a different split → honor the exact number (decision tree)

**Prelude (every counter-proposal):** Honor the user's **exact number** — no snap-to-cell. Confirm the updated split in shekels and percent in the same `ask_user` call. Then add **exactly one** of Branches 1–3 below.

**Branch 1 — Extreme mismatch (40+ pp outside the recommended range).** Add a directional sanity check using the matching pattern, then accept the user's final answer. Surface the mismatch **once** per conversation; do not re-challenge.

- _Too-high direction_ (e.g., conservative profile, user asks 100%): "Your earlier answers suggested you're uncomfortable with big drops — going 100% stocks could mean watching 30–50% of your portfolio disappear in a bad year. Still want to go there?"
- _Too-low direction_ (e.g., aggressive long-horizon profile, user asks 0%): "Your earlier answers indicated a long horizon and comfort with bigger swings (recommended range X–Y%) — going to 0% stocks means your entire ₪Z stays in buffer, giving up most of the long-run growth stocks typically provide over many years. Still want to proceed with 0% equity?"

**Branch 2 — First counter-proposal in the conversation (not extreme).** Add one compound-impact trade-off sentence over the user's timeline: more equity → bigger drawdowns and meaningfully more long-run growth as gains stack year after year; less equity → smaller drawdowns and meaningfully less long-run growth as forgone gains compound. Reference the user's specific timeline (e.g., "over your 10+ year horizon").

**Branch 3 — Subsequent counter-proposals (compound-impact framing already delivered).** Just confirm the new split and ask whether the user wants to proceed. No framing.

**Why exact-number, not snap-to-cell:** haggling with the user undermines the "user has final say" principle. Branch 1 is our guardrail for the extreme end.

**Scenarios:**

- Proposal 85/15 (aggressive, 10+ years). User: "Make it 82." → Branch 2 (first counter, not extreme): honor exactly, compound-impact framing, end. Extract 82/18.
- Proposal 85/15. User: "Make it 77." → Branch 2: honor exactly (below cell edge but not extreme), compound-impact framing, end. Extract 77/23.
- Proposal 85/15. User: "Make it 50/50." → Branch 2: honor, compound-impact framing, end. Extract 50/50.
- Proposal 85/15. User: "Make it 60." then "Make it 55." → Branch 2 on first counter (compound-impact framing); Branch 3 on second counter (bare confirm, no framing). Extract 55/45.
- Proposal 45/55 (conservative, 10+ years). User: "Make it 100%." → Branch 1 too-high (drawdown framing): "Your earlier answer suggested you're uncomfortable with big drops — going 100% stocks could mean watching 30–50% of your portfolio disappear in a bad year. Still want to go there?" User: "Yes." → extract 100/0.
- Proposal 85/15 (aggressive, 10+ years). User: "Make it 0%." → Branch 1 too-low (opportunity-cost framing): "Your earlier answers indicated a long horizon and comfort with bigger swings (recommended range 80–90%) — going to 0% stocks means your entire ₪50,000 stays in buffer, giving up most of the long-run growth stocks typically provide over many years. Still want to proceed with 0% equity?" User: "Yes." → extract 0/100.

**What counts as extreme** is a qualitative judgment: the proposed split is 40+ pp away from the cell anchor, so the mismatch with the user's stated profile is obvious. Examples: conservative asking for 100% stocks, short-horizon asking for all equity, aggressive 10+ yr asking for 0% equity. Trust model judgment on the grey cases — evals will catch drift.

---

## 4. User asks a clarifying question → explain briefly, then re-ask

**Rule:** If the user replies to the Rule 1 proposal with a question instead of an answer, answer briefly and honestly, then re-present the same anchor question in the same `ask_user` call.

**Explanation scope:**

- **Concept questions** (what equity is, what a buffer is for, why split at all, what a money-market fund / קרן כספית is): answer in one or two sentences.
- **Method questions** ("how did you come up with 70/30?"): name the two inputs — investment timeline and comfort with drops — and note the split reflects both. Do **not** use the words `conservative`, `moderate`, or `aggressive` when speaking to the user — not even as general adjectives — and do not show the anchor table.
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

## Budget exhaustion

If the phase loop exhausts `MAX_ALLOCATION_TOOL_CALLS`, `runPhaseLoop()` throws `PhaseLoopToolCallsExhaustedError`. `collectAllocation` catches it and returns `{ status: "unresolved", reason: "allocation" }`; the orchestrator sends a closing message and the pipeline exits.

## Out of scope

- **Instrument selection.** If the user asks "which ETF?" or "which money-market fund?", deflect to later phases (T5 equity / T6 buffer) and bring the conversation back to sizing.
- **EF / debt collection.** Emergency fund and debt status are collected and addressed in the ef-debt phase (an educational gate) before the parameters phase. This phase does not consume them.
