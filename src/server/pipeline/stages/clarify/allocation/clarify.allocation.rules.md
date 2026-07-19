# Clarify Allocation Phase — Behavior Rules

Behavioral rules for the allocation phase. This phase converts the user's `riskTolerance` (a 1–5 score from the risk phase) and timeline (from the parameters phase) into a **total-portfolio split** between two buckets: equity (stocks / stock ETFs) and buffer (cash, money-market funds, short-term bonds). Output is two integers summing to 100. The 1–5 `riskTolerance` keys the anchor table below directly — there is no intermediate `conservative`/`moderate`/`aggressive` bucket.

This phase does **not** pick instruments. Ticker selection belongs to T5 (equity) and T6 (buffer).

## Anchor Table (riskTolerance × timeline)

| `riskTolerance` \ Timeline | 3–5 years | 5–10 years | 10+ years |
| -------------------------- | --------- | ---------- | --------- |
| 1                          | 10–20%    | 30–40%     | 40–50%    |
| 2                          | 10–20%    | 30–40%     | 40–50%    |
| 3                          | 20–30%    | 50–60%     | 60–70%    |
| 4                          | 30–40%    | 60–70%     | 80–90%    |
| 5                          | 30–40%    | 60–70%     | 80–90%    |

Scores pair up onto shared ranges by design — 1≡2 (cautious) and 4≡5 (bold) — with score 3 (neutral) on a range of its own. The duplicated rows are intentional: the within-cell edge selection (Rule 1) then splits each shared range so every score still lands at a distinct point. There are three distinct ranges per timeline, not five.

All cells are **ranges**, not points. The specific equity percentage inside a cell is **precomputed in code** based on the user's `riskTolerance` (see Rule 1 → Within-cell discrimination). Buffer percentage is always `100 - equity`.

Users with an `under 3 years` timeline never reach this phase — the orchestrator exits early after parameters collection and redirects them to a money market fund. This phase only receives timelines of `3–5 years`, `5–10 years`, or `10+ years`.

The advisor **never pins a risk personality on the user** — not "you're an aggressive investor", not "your moderate profile", nor any equivalent "you're a ___ investor" label. This is a UX no-label rule: a single 1–5 self-rating is too thin to hand a beginner a risk identity. It is broader than any fixed word list — `conservative`/`moderate`/`aggressive` are just the most common examples (`ALLOCATION_RISK_LABEL_EXAMPLES`, injected into the composer prompts), and the rule is graded by the allocation judge's `no-risk-labeling` criterion rather than a token scan. Factually restating the user's own answers ("your timeline is long", "you said big drops make you uncomfortable") is not a label and is fine; so are plain, non-personal uses like "a moderate amount in stocks". Internal "cell" terminology is also never exposed to the user; the cell range is referred to as the "recommended range" in user-facing text.

## Design constraints

- **Point-estimate, not distribution.** Output is a single integer (e.g., 70), not a range. Acceptable for a behavioral anchor; not acceptable as portfolio-optimization output.
- **"Sizing tends to reduce panic-selling" — directional, not absolute.** Use "tends to reduce"; never "prevents" or "eliminates". Aligned with Kitces's composure-vs-tolerance distinction.
- **3 distinct anchor ranges is coarser than industry norm.** Vanguard uses 9 anchors, Fidelity 7. The 1–5 `riskTolerance` maps onto only three distinct ranges per timeline (scores 1≡2 and 4≡5 share a range); the within-cell edge selection then spreads the five scores across five distinct landing points inside those ranges (see Rule 1).

---

## 1. Propose the cell-appropriate anchor

**Rule:** On entry, the equity percentage and shekel amounts are **precomputed in code** (`collectAllocation` in `clarify.allocation.ts`). The initial proposal message is also rendered **in code** (`buildInitialProposal`) — no LLM call — so the Rule 1 contract is enforced deterministically. The proposal must include:

- The split in **shekels** against the user's investment amount (e.g., "₪35,000 in stock ETFs and ₪15,000 in a buffer — roughly 70/30"). Not percentage-only.
- One honest trade-off sentence **in relative terms**: more equity → bigger drops in bad years + higher long-run growth; less equity → smaller drops + lower growth. **No specific drawdown percentages in this turn** — they age badly and invite false precision.
- The behavioral framing: "sizing to your comfort level **tends to reduce** the chance of panic-selling when drops happen." Never "prevents" or "eliminates".
- A question asking whether the user wants that split, more in stocks, or more in buffer.

### Within-cell discrimination

The equity percentage inside a cell is selected by `deriveAnchorEquityPercentage(cell, riskTolerance)`:

| `riskTolerance` | Position in cell | Formula                     |
| --------------- | ---------------- | --------------------------- |
| 1, 4            | Low end          | `cell.min`                  |
| 2, 5            | High end         | `cell.max`                  |
| 3               | Midpoint         | `(cell.min + cell.max) / 2` |

Score 3 hits the midpoint because it has its anchor row to itself — unlike the paired 1≡2 and 4≡5 rows, there is no second score to split the range's low/high edge with. Landing on the cell edges keeps proposals round (80/20, 90/10) rather than awkward insets like 82/18 or 88/12.

**Scenarios:**

- Score 5, 10+ years, ₪50,000 → 90% equity (cell.max) → propose ₪45,000 / ₪5,000.
- Score 3, 5–10 years, ₪80,000 → 55% equity (midpoint) → propose ₪44,000 / ₪36,000.
- Score 2, 3–5 years, ₪30,000 → 20% equity (cell.max) → propose ₪6,000 / ₪24,000.
- Same row, different score: score 4 at 10+ yr → 80% equity (cell.min), not 90% (score 5). The score selects the edge within the shared range.

---

## 2. User accepts → end the phase

**Rule:** If the user replies with a clear yes (e.g., "sounds good", "ok", "yes", "let's do it") to the **currently proposed split**, the phase resolves immediately. No wrap-up message, no re-confirmation. The classifier returns `kind: "accept"` and the turn handler returns `Done` at `conversationState.currentEquityPercentage` (anchor if untouched, latest counter otherwise) with no closing message.

**Retraction to the original anchor.** After one or more counters, a reply that signals acceptance but explicitly retracts to the *original* proposal — without naming a number (e.g., "actually, never mind — stick with your original suggestion", "let's go back to the first proposal", "I'll trust your original split") — is classified as `kind: "accept-original"`. The handler resolves to `anchorEquityPercentage` (the initial precomputed proposal), not `currentEquityPercentage`. This closes the gap where a verbal retraction would otherwise lock in the abandoned counter. If the retraction-shaped reply *names* a number ("actually, stick with the original 88"), it is a counter (Rule 3) — the named number takes precedence.

**Last-turn behavior.** Both `accept` and `accept-original` win even when a budget is already exhausted — accept is gated ahead of both budget checks (see Budget exhaustion). Returning `unresolved` after a clear acceptance would be a UX regression.

**Disambiguation:** A response that names a specific percentage or ratio different from the current proposal — even if phrased as acceptance (e.g., "let's do 50/50", "I want 60%") — is a counter-proposal. Apply Rule 3 instead.

---

## 3. User proposes a different split → honor the exact number (decision tree)

**Prelude (every counter-proposal):** Honor the user's **exact number** — no snap-to-cell. The classifier extracts the user's `proposedEquityPercentage`; code selects the branch (extreme / compound-impact / bare) deterministically from `{counters, hasShownExtremeFraming, hasShownCompoundImpactFraming}`; the counter composer renders the reply with the new split in shekels and percent plus the branch-specific framing.

**Branch 1 — Extreme mismatch (40+ pp outside the recommended range).** Add a directional sanity check using the matching pattern, then accept the user's final answer. Surface the mismatch **once** per conversation; do not re-challenge.

- _Too-high direction_ (e.g., conservative profile, user asks 100%): "Your earlier answers suggested you're uncomfortable with big drops — going 100% stocks could mean watching 30–50% of your portfolio disappear in a bad year. Still want to go there?"
- _Too-low direction_ (e.g., aggressive long-horizon profile, user asks 0%): "Your earlier answers indicated a long horizon and comfort with bigger swings (recommended range X–Y%) — going to 0% stocks means your entire ₪Z stays in buffer, giving up most of the long-run growth stocks typically provide over many years. Still want to proceed with 0% equity?"

**Branch 2 — First counter-proposal in the conversation (not extreme).** Add one compound-impact trade-off sentence over the user's timeline: more equity → bigger dips when markets fall but more long-run growth; less equity → smaller dips but less long-run growth. Say it in **plain words a beginner understands** — avoid jargon like "forgone gains compound", "gains stack", or "drawdowns". Keep it to short sentences (confirm the split, then the trade-off, then the proceed question), and reference the user's specific timeline (e.g., "over your 10+ year horizon").

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

**Rule:** If the user replies to the Rule 1 proposal with a question instead of an answer, answer briefly and honestly, then re-present the current proposal. The classifier returns `kind: "question"` and dispatches to the question composer.

**Explanation scope:**

- **Concept questions** (what equity is, what a buffer is for, why split at all, what a money-market fund / קרן כספית is): answer in one or two sentences, covering **only the concept asked** — do not drift into an adjacent one (e.g. defining a money-market fund, then explaining why the portfolio is split).
- **Method questions** ("how did you come up with 70/30?"): name the two inputs — investment timeline and comfort with drops — and note the split reflects both. Do **not** pin a risk personality on the user (no "you're a conservative/moderate/aggressive investor" or similar) and do not show the anchor table.
- **Instrument questions** ("which ETF?", "which money-market fund?"): say that's the next step after we settle on the split, and bring the conversation back to sizing.

**Scenarios:**

- "What's a buffer?" → "A buffer is the portion of your portfolio held in something stable like cash, a money-market fund, or short-term bonds. It smooths volatility and acts as a cushion when stocks drop." → re-ask.
- "How did you get to 70/30?" → "Two inputs: your investment timeline and your comfort with drops. A longer horizon and higher comfort shift toward more stocks; the 70/30 reflects both." → re-ask.
- "Which ETF should I buy?" → "That's the next step after we settle on the overall split. For now — does 70/30 sound right, or more/less in stocks?" (the re-ask is the deflection).

---

## 5. Unparseable or numberless replies → re-ask, stay open

**Rule:** When the user's reply can't be turned into an accept, counter, or question, the phase stays open. Two shapes, handled at different layers:

- **`unknown` intent → re-ask.** The reply is ambiguous, off-topic, or names no number where one is needed — including a bare directional phrase like "more in stocks" with no figure (the classifier labels these `unknown`, not `counter`, because it cannot guess a number). `resolvePromptDecision` re-asks with the fixed `ALLOCATION_UNKNOWN_INTENT_MESSAGE` ("I didn't catch that. Want the proposed split, more in stocks, or more in buffer?"), rendered **in code** (a constant in `clarify.allocation.constants.ts`, not the LLM). The turn still counts against the total-turn backstop, but not the negotiation budget — only counters advance that.
- **`counter` intent with no number → throw.** A `counter` with `proposedEquityPercentage === null` is model disobedience: the classifier prompt routes numberless input to `unknown`, so a well-behaved classifier never emits it. `classifyTurn` re-parses the flat classifier output through the resolved `AllocationIntentSchema` (whose `counter` variant requires a number), so this shape fails that parse and throws `BadGatewaySchemaValidationError` (a 502 — bad upstream response) at the io boundary, before the turn handler runs. Because it's unreachable through normal classification it has no eval; it's covered by the resolved-schema parse test in `clarify.allocation.io.test.ts`.

## Turn budget

Two counters in the threaded conversation state, each with its own cap in `clarify.allocation.constants.ts`:

- **Negotiation budget — `MAX_NEGOTIATION_TURNS = 5`.** Counts only counter-proposals (`negotiationTurnsTaken`). Questions and unknown replies don't advance it: they don't move the split, so haggling over the number isn't what's being bounded. A beginner can ask as many clarifying questions as the total budget allows without ever spending a negotiation turn.
- **Total-turn backstop — `MAX_TOTAL_TURNS = 10`.** Counts every reply type (`totalTurnsTaken`). Bounds a conversation that never converges — e.g. an endless run of questions — so it exits gracefully as `unresolved` instead of climbing into `runConversation`'s 500-level hard stop. Sits above the negotiation cap; the gap is the room a patient user gets for questions.

Both counters read as "turns already served," so a cap of N allows N replies before the gate fires. Typical paths:

- **Happy path:** initial proposal + user accepts on turn 1 = 0 negotiation turns, 1 total.
- **Counter-proposal path:** initial proposal + counter + accept = 1 negotiation turn, 2 total.
- **Clarifying question path:** initial proposal + question + accept = 0 negotiation turns, 2 total.
- **Sanity-check path:** initial proposal + extreme counter (with sanity check) + accept = 1 negotiation turn, 2 total.
- **Worst case in evals** (question + counter + accept) = 1 negotiation turn, 3 total — well within both budgets.

## Budget exhaustion

The `runConversation` runner enforces no budget — convergence is the handler's responsibility. Each turn the handler classifies the user's reply first, then applies three gates in order:

1. **Accept wins outright.** If the intent is `accept`/`accept-original`, the phase resolves to `completed` even when a budget is already spent — closing on the user's "yes" is the right UX; returning `unresolved` after a clear acceptance would feel broken.
2. **Total-turn backstop.** If `totalTurnsTaken` has reached `MAX_TOTAL_TURNS`, return `Done` with `{ status: "unresolved", reason: "allocation" }`, regardless of intent.
3. **Negotiation budget.** If the reply is a `counter` and `negotiationTurnsTaken` has reached `MAX_NEGOTIATION_TURNS`, return the same `unresolved` result. Gated *before* composing, so a refused counter never spends a composer call.

The orchestrator maps `unresolved`/`allocation` to `ALLOCATION_EXIT_MESSAGE` — both caps share the exit message; only the log line differs. The trade-off is one extra classifier call on the exhausting turn (cheap, low-effort `nano` call) in exchange for not throwing away a final acceptance.

## Out of scope

- **Instrument selection.** If the user asks "which ETF?" or "which money-market fund?", deflect to later phases (T5 equity / T6 buffer) and bring the conversation back to sizing.
- **EF / debt collection.** Emergency fund and debt status are collected and addressed in the ef-debt phase (an educational gate) before the parameters phase. This phase does not consume them.

## Quality judging (dev-only eval layer)

Beyond the schema/behavior assertions in `clarify.allocation.eval.ts`, the LLM-composed turns are scored for prose quality by an LLM judge (`clarify.allocation.judge.ts`) — the allocation phase is the **pilot** for this pattern. It catches what regex can't: wordiness, scope-bleed, jargon, and tone. The judge runs only under `npm run test:evals` (never CI) and fails the eval when a criterion fails; verdicts are written to `clarify.allocation.last-run.md`. General mechanics live in [TESTING § Quality judging](../../../../../../documentation/TESTING.md#quality-judging-llm-as-judge). Criteria graded here:

- **conciseness** — each turn says what it needs and stops; no run-ons, no restating the same numbers (the required re-ask is expected, not bloat).
- **answer-scoping** — Rule 4 answers stay on the asked topic and don't bleed into adjacent territory; the mandated re-ask is in-scope.
- **naturalness** — calm, matter-of-fact, no filler openers ("Great", "Sure", "Of course", "Understood", "Got it").
- **framing-plain-language** — Rule 3 trade-off framing reads as plain beginner language tied to the user's timeline/amounts, not a keyword drop.
- **no-risk-labeling** — no turn pins a risk personality on the user (e.g. "you're an aggressive investor", "your moderate profile"); factual restatements of the user's own answers, and plain non-personal uses like "a moderate amount", are fine.
- **english-body** — the message body is English; naming an Israeli instrument by its Hebrew term inline (e.g. `קרן כספית`) is allowed. Graded on the Hebrew-instrument question case.
