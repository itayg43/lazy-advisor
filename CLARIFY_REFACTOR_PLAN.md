# Clarify Stage Refactor Plan

## Context

The clarify stage currently chains phases via `previous_response_id` — each phase passes its OpenAI response ID to the next, with a single extraction call at the end reading the full cross-phase conversation. This creates tight coupling, makes phases hard to test in isolation, and buries `riskTolerance` collection inside a bloated fields phase.

The spec (`CLARIFY_REVIEW.md`) redesigns this as a typed I/O pipeline: each phase gets a post-loop extraction call that produces structured output, and phases receive plain typed inputs from the orchestrator. A new dedicated risk phase isolates `riskTolerance` resolution. The `contradictory` intake path is dropped (risk contradiction is now handled naturally by the risk phase). Brokerage is removed from the profile.

---

## Dependency Graph

```
Phase 1 (constants)  ──────────────────────────────────────────────────────────┐
Phase 2 (schemas)    ─────────────────────────────────────────────────────┐    │
                                                                           ↓    ↓
Phase 3 (fields refactor)  ─────────────────────────────────────────────► Phase 8 (orchestrator)
Phase 4 (risk) ─► Phase 4b (allocation) ─► Phase 5a (equity) ─► Phase 5b (buffer) ─► Phase 8
Phase 6 (thin extraction)  ─────────────────────────────────────────────► Phase 8
Phase 7 (intake cleanup)  ──────────────────────────────────────────────► Phase 8
                                                                              │
                                                      ┌───────────────────────┘
                                                      ▼
                                              Phase 9 (eval alignment)
                                              Phase 10 (rules files)
```

Phases 1 & 2 are parallel. Phases 3, 6, 7 are parallel once 1 & 2 are done. Phase 4 → 4b → 5a → 5b is a strict chain: 4b depends on `RiskPhaseOutput`, 5a depends on `AllocationPhaseOutput`, 5b depends on `EquityPhaseOutput` (and `AllocationPhaseOutput`). Phase 8 gates everything. Phases 9 & 10 are post-integration cleanup.

---

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Expand `clarify/shared/clarify.constants.ts` | Complete |
| 2 | Create typed I/O schemas | Complete |
| 3 | Refactor fields phase to typed I/O | Complete |
| 3b | Create the contribution phase | Complete |
| 4 | Create the risk phase | Complete (single 20% probe) |
| 4 re-open | Single-question 1-5 self-rating (supersedes two-tier A/B) | In progress — design decided 2026-04-21; implementation pending (see Phase 4 re-open section below) |
| 4b | Create the allocation phase (equity vs. buffer sizing) | Not started — see Phase 4b section below |
| 5a | Create the equity phase (split from preferences) | Paused — scope revised; now depends on Phase 4b |
| 5b | Create the buffer phase (split from preferences) | Not started — depends on Phase 4b and 5a |
| 6 | Refactor extraction to thin assembly | Not started |
| 7 | Intake cleanup: drop contradictory, update out-of-scope and unrealistic | Not started |
| 8 | Wire new pipeline in `clarify.stage.ts` | Not started |
| 9 | Eval alignment pass | Not started |
| 10 | Rules files for remaining phases | Not started |

---

## Phases


### Phase 4 re-open — Single-question 1-5 self-rating (supersedes two-tier A/B)

**Status:** Design decided 2026-04-21 after a web-verified research pass. The prior two-tier A/B design is superseded. Implementation pending.

**What changed and why:** The previous Phase 4 re-open design (two-turn A/B drop scenarios with historical-recovery framing) has been replaced with a single-question 1–5 self-rating. The switch was driven by research: direct self-rating items have higher predictive validity than hypothetical scenario questions (Statman, Kitces, CFA Institute *Psychometric Review*), and historical-recovery framing is a documented priming bias specific to risk-tolerance questionnaires. The prior design also exhibited an intermittent prompt-adherence flake (~1 in 3–4 runs); the new single-turn shape removes the multi-step flow entirely, so the flake disappears structurally. Full rationale, sources, trade-offs, and rejected alternatives (including a pension-past-behavior probe) are in [`src/server/pipeline/stages/clarify/risk/clarify.risk.research-notes.md`](src/server/pipeline/stages/clarify/risk/clarify.risk.research-notes.md).

**Signature unchanged:** `collectRisk(goal, fields, sendToUser, waitForResponse): Promise<RiskPhaseOutput>`. `goal` remains grounding only; `fields` is kept in the signature for consistency and future extensibility but is not read by the classifier (the scale is willingness-only; capacity stays in Phase 4b).

**Output schema (updated):**

```ts
type RiskPhaseOutput = {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  selfRatingScore: 1 | 2 | 3 | 4 | 5;   // preserved so Phase 4b can calibrate if needed
};
```

**Flow:** single turn. Phase asks one question: a 1–5 self-rating of comfort with temporary drops, with concrete behavioral anchors at 1, 3, and 5. User responds with a number. Deterministic mapping:

- 1–2 → `conservative`
- 3 → `moderate`
- 4–5 → `aggressive`

**Anchor wording (draft — rules file owns final text):**

> "Before we design your allocation, I need to understand your comfort with market ups and downs. On a scale of 1 to 5, how would you describe your comfort with seeing your investments drop temporarily?
>
> 1 = very uncomfortable — I'd want to sell immediately
> 3 = neutral — I'd be uneasy but try to hold
> 5 = completely comfortable — I'd see it as a buying opportunity"

**Edge cases:**

- Number outside 1–5 or non-numeric answer → re-ask once with the scale; still unresolved → default to `moderate`.
- User asks a clarifying question before answering → answer it honestly (what the scale means, why we're asking), then re-present the scale.
- No market-timing redirect needed — no scenario framing to redirect from.
- No educational fallback needed — the anchors are the education.

**Neutrality guidance (for the rules file):**

- Do not suggest a "typical" answer or imply a socially-desired response.
- Do not add historical reassurance ("markets have recovered") — this re-introduces the priming bias the new design avoids.
- If evals reveal misclassification, tighten the score→bucket mapping before adding scenario content back into the prompt.

**What this eliminates (compared with the superseded two-turn A/B design):**

- Two-turn A/B flow, educational fallback, market-timing redirect, prompt-based state machine.
- Historical-recovery framing (source of the priming concern).
- Post-loop extraction call (mapping is deterministic).
- The planned code-based state-machine refactor — the complexity it was meant to solve no longer exists.

**Files:**

- `src/server/pipeline/stages/clarify/risk/clarify.risk.ts` — rewrite as single-question flow. Remove two-turn logic, educational fallback, market-timing redirect, post-loop extraction. Add deterministic score→bucket mapping.
- `src/server/pipeline/stages/clarify/risk/clarify.risk.rules.md` — rewrite: single-turn flow, final anchor wording, neutrality guidance, edge-case handling.
- `src/server/pipeline/stages/clarify/risk/clarify.risk.prompts.ts` — rewrite as a single prompt; may be small enough to inline into `clarify.risk.ts` (decide at implementation time).
- `src/server/pipeline/stages/clarify/risk/clarify.risk.eval.ts` — rewrite: 5 core cases (one per score 1–5), plus edge cases (out-of-range, clarifying question, non-numeric → default, extreme wording like "absolutely not" → map to 1).
- `src/server/pipeline/stages/clarify/shared/clarify.schemas.ts` — update `RiskPhaseOutputSchema` to add `selfRatingScore`.
- `src/server/pipeline/stages/clarify/shared/clarify.constants.ts` — reduce `MAX_RISK_TOOL_CALLS` (suggest 2; worst case: clarifying question + answer).

**Tool-call budget:** `MAX_RISK_TOOL_CALLS` drops to 2.

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.risk.eval.ts`.

---

### Phase 4b — Create the allocation phase (equity vs. buffer sizing)

**What:** New dedicated phase resolving the user's equity-vs-buffer split at the **total portfolio level**. Sits between the risk phase and the equity phase.

**Why this is its own phase:** Risk tolerance isn't just classification — it's **behavioral protection**. A user who says "I'd sell at 20%" shouldn't land at 100% equity, because the first 20% drop would trigger exactly the panic-sell behavior they self-reported. Sizing the equity bucket to tolerance (with the rest in a stable buffer like קרן כספית) is what makes risk classification actionable: a 20% stock drop on 40% equity is an 8% total portfolio drop — tolerable enough to hold through. This sizing decision is distinct from instrument selection, depends on multiple fields, and deserves its own phase. Cramming it into equity recreates the "preferences phase bloat" the refactor is built to eliminate.

#### Signature

```ts
export const collectAllocation = async (
  goal: string,
  fields: FieldsPhaseOutput,
  risk: RiskPhaseOutput,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<AllocationPhaseOutput>
```

Phase 8 call site: `collectAllocation(activeGoal, fieldsOutput, riskOutput, sendToUser, waitForResponse)`.

#### Output schema

```ts
type AllocationPhaseOutput = {
  equityPercentage: number;   // 0–100, integer
  bufferPercentage: number;   // 100 - equityPercentage
};
```

Zod validation: both integers in [0, 100], `equityPercentage + bufferPercentage === 100`.

Add `AllocationPhaseOutputSchema` to `clarify/shared/clarify.schemas.ts`.

#### Multi-factor anchor logic

The prompt guides the agent to propose a sizing anchor derived from multiple params, not a single-variable lookup. Factors and directional effects:

| Factor | Effect on anchor equity % |
|--------|----------------------------|
| `risk.riskTolerance` (primary) | Lower tolerance → lower anchor |
| `fields.timeline` (primary) | Shorter timeline → lower anchor (less time to recover from a late drop) |
| `fields.age` | Older → slightly lower anchor on the margin (fewer earning years to recover from bad outcomes) |
| `fields.hasEmergencyFund` | If false → lower anchor (less cushion against forced sales) |
| `fields.hasDebt` | If true → lower anchor marginally (opportunity cost of equity vs. paying debt) |
| `goal` | Grounding only unless the goal specifies a hard deadline; do not use goal wording as risk signal |

Illustrative anchor ranges (prompt should compute from the combination, not hard-code a lookup):

| Risk | Short timeline (<5yr) | Long timeline (>10yr) |
|------|------------------------|------------------------|
| Conservative | 20–40% | 40–60% |
| Moderate | 40–60% | 60–80% |
| Aggressive | 50–70% | 80–100% |

These are **starting points for the conversation**, not caps. Further modulation from age / emergency fund / debt is applied on top.

#### Conversation principles

- **Informative and clear about trade-offs.** The agent opens by computing an anchor from the profile and presenting it with concrete rationale using `fields.amount` + historical drawdown figures:
  > "Based on your risk profile, 25-year timeline, and comfort with drops, around 70% of your ₪50,000 in stocks and 30% in a stable buffer (like קרן כספית) makes sense as a starting point. A 20% stock drop would mean roughly ₪7,000 off your total portfolio — not ₪10,000 — because the buffer holds steady. Does 70/30 feel right, or would you want more or less in stocks?"
- **User has final say.** The anchor is informed, not prescriptive. User can accept, nudge up/down, or pick a different split entirely.
- **Both sides of the trade-off, honestly.** More equity → higher expected return over long horizons, bigger drawdowns. Less equity → smaller drawdowns, lower expected return. Agent explains both when user questions the anchor or proposes a deviation.
- **Pre-stated case:** if the user's goal stated a split ("60% stocks 40% buffer", "put half in קרן כספית"), extract directly; skip the conversation loop. Unit-test this early-exit.

#### Context string format

```
User goal: <goal>
Investment amount: ₪<fields.amount>
Investment timeline: <fields.timeline>
Age: <fields.age>
Has emergency fund: <fields.hasEmergencyFund>
Has debt: <fields.hasDebt>
Risk tolerance: <risk.riskTolerance>
```

#### Unit test

One unit test for the pre-stated-split early-exit branch (assert no `sendToUser` call, assert output matches extracted values). Rest of behavior via evals.

#### Files

- `src/server/pipeline/stages/clarify/allocation/clarify.allocation.ts` — new
- `src/server/pipeline/stages/clarify/allocation/clarify.allocation.rules.md` — new (rule-per-case structure: pre-stated split early-exit; anchor acceptance; user nudges up; user nudges down; user asks why; user proposes radically different split)
- `src/server/pipeline/stages/clarify/allocation/clarify.allocation.eval.ts` — new (cases per rule)
- `src/server/pipeline/stages/clarify/allocation/clarify.allocation.test.ts` — new (pre-stated split early-exit)
- `src/server/pipeline/stages/clarify/shared/clarify.schemas.ts` — add `AllocationPhaseOutputSchema`
- `src/server/pipeline/stages/clarify/shared/clarify.constants.ts` — add `MAX_ALLOCATION_TOOL_CALLS` (suggest 5)

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.allocation.eval.ts`.

---

### Phase 5a — Create the equity phase (split from preferences)

**What:** Split the preferences phase into two dedicated phases. Phase 5a becomes the **equity** phase — responsible only for resolving equity instruments + split. The buffer decision moves to phase 5b.

**Why split:** Combining equity and buffer in one phase produced structural pain — binary equity guard, bundling complement question with buffer, multi-branch decision logic. Equity and buffer are two distinct decisions; the refactor's typed-I/O single-responsibility premise applies here too.

#### Directory restructure

Rename `clarify/preferences/` → `clarify/equity/`. Files become:
- `clarify/equity/clarify.equity.ts`
- `clarify/equity/clarify.equity.rules.md`
- `clarify/equity/clarify.equity.eval.ts`

#### Signature (decided)

```ts
export const collectEquity = async (
  goal: string,
  fields: FieldsPhaseOutput,
  risk: RiskPhaseOutput,
  allocation: AllocationPhaseOutput,
  contribution: ContributionPhaseOutput,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<EquityPhaseOutput>
```

Phase 8 call site: `collectEquity(activeGoal, fieldsOutput, riskOutput, allocationOutput, contributionOutput, sendToUser, waitForResponse)`.

**Scope boundary:** Phase 5a resolves **which equity instruments** fill the equity bucket and **how they split within it**. It does **not** resolve how much of the total portfolio is equity — that's Phase 4b's job. `allocation.equityPercentage` is passed as grounding ("you've chosen X% of your portfolio in stocks — which stocks?"), not as something this phase negotiates.

#### Output schema

```ts
type EquityAllocation = {
  name: string;        // canonical for known anchors: "S&P 500", "FTSE All-World",
                       // "MSCI World", "NASDAQ-100", "TLV-125". Free-form for sector ETFs.
  percentage: number;  // integer 0–100
};

type EquityPhaseOutput = {
  allocations: EquityAllocation[];   // length ≥ 1; sum of percentages === 100
                                     // percentages are WITHIN-EQUITY — they split the equity
                                     // bucket sized by Phase 4b, not the total portfolio
  preStatedBuffer?: string;          // incidentally-stated buffer preference, if any
                                     // e.g. "קרן כספית" or "no buffer — emergency fund held separately"
};
```

Zod validation: `allocations.length >= 1`, each `percentage` is an integer in [0, 100], sum of percentages === 100.

**Note on semantics:** `allocations[].percentage` represents the **within-equity split** (summing to 100). Total-portfolio exposure for a given instrument is `allocation.equityPercentage × allocations[i].percentage / 100`. Downstream consumers (research, plan, extraction) do this conversion when they need total-portfolio figures.

**Why structured over string:** an allocation is literally a list of (instrument, weight) pairs — the string `"70% FTSE All-World, 30% TLV-125"` is a lossy serialization. Downstream stages (research, plan) need to iterate per-instrument; parsing prose is fragile. Schema-level validation also catches "percentages don't sum to 100" at the boundary rather than trusting the prompt.

**Why `name` is free-form string (not enum):** known anchors have canonical names, but sector ETFs don't enumerate cleanly. Prompt nudges the model toward canonical names for known instruments; downstream code can normalize with a lookup table if needed.

The optional `preStatedBuffer` is captured by the post-loop extraction when the user volunteers buffer info during the equity conversation (e.g., "FTSE All-World. קרן כספית for the buffer." or "100% S&P 500. No buffer — emergency fund is outside this portfolio."). Phase 5b receives it as input and skips its conversation loop when present.

Replace `PreferencesPhaseOutputSchema` with `EquityAllocationSchema` + `EquityPhaseOutputSchema` in `clarify/shared/clarify.schemas.ts`.

#### Context string format

```
User goal: <goal>
Investment amount: ₪<fields.amount>
Investment timeline: <fields.timeline>
Risk tolerance: <risk.riskTolerance>
Equity portion of portfolio: <allocation.equityPercentage>% (buffer is <allocation.bufferPercentage>%)
Plans to contribute periodically: yes | no (lump-sum investment)
```

#### Architecture: classify-then-route

Instead of a single prompt handling all equity cases, `collectEquity` uses two steps:

1. **`classifyEquityIntent`** (in `clarify.equity.classify.ts`): lightweight LLM call that reads `goal` and returns one of four classifications.
2. **Code routing** to a focused prompt per classification, then `runPhaseLoop`.

The classify call happens once at the start. Each focused prompt handles its natural follow-ups (the only follow-up needed across all prompts is: "if 2+ instruments named without split → ask for split"). No re-classification per turn.

**Why this structure:** A single monolithic prompt with multi-branch decision logic exceeds the ~40-instruction adherence threshold where models begin half-attending to steps. Classifying first and routing to focused prompts keeps each prompt small and single-responsibility.

**Approach B (backup):** Re-classify after each user response and switch the prompt via `previous_response_id`, preserving conversation history. Noted as fallback if Approach A yields poor eval results.

#### Classification cases

| Case | Condition |
|------|-----------|
| `resolved` | 1 instrument named (implied 100%) OR explicit percentage split stated |
| `split_missing` | 2+ instruments named, no percentages |
| `no_specific_instrument` | Direction signaled ("tech", "global", "US") but no specific instrument |
| `no_equity_stated` | Nothing stated about equity — the primary path for most beginners |

**Key decisions:**
- A named single instrument (e.g., "I want S&P 500") is treated as `resolved` (implied 100%) — no complement push.
- `no_equity_stated` is the dominant path for beginner users who start with "I want to invest" or "I don't know where to start."
- TLV-125 is presented as an anchor option within `no_specific_instrument` and `no_equity_stated` prompts. It is not suggested as a complement when equity is already `resolved`.
- For `no_specific_instrument` with tech direction: NASDAQ-100 is the primary answer (broad, not a sector ETF). Sector ETFs are mentioned as a more concentrated alternative.

#### Conversation principles

- **This is a conversation, not a form.** The agent is informative and educational — it provides context, explains trade-offs, and answers follow-up questions fully before asking for a decision.
- **Use real data.** Make compounding examples concrete with `fields.amount`, `fields.timeline`, and historical return rates (e.g., "₪50,000 at ~10%/yr over 25 years ≈ ₪540,000"). Abstract percentages don't land for beginners; shekel figures do.
- **Ground framing in `allocation.equityPercentage`.** The equity bucket is already sized. Frame choices against it: "You've chosen 70% of your ₪50,000 in stocks — ₪35,000. Which stocks fill that?"
- Each focused prompt stays under ~40 instructions.
- **No risk-based instrument filtering.** A conservative user can pick NASDAQ-100 for their equity bucket if they want. Sizing is what protects behavior (Phase 4b). Instrument presentation should be neutral on risk — classify-then-route is about goal signals, not risk signals.
- **No conservative-warning rule.** Allocation sizing (Phase 4b) is the primary behavioral safeguard. A conservative user at 40% equity holding NASDAQ-100 has the same total-portfolio drawdown exposure as an aggressive user at 40% in broad-market — the phase has done its job upstream. Reactive warning logic here would violate the typed-I/O premise.

#### Examples

**`resolved` — single instrument (primary beginner path after hint)**
```
goal: "I want to invest ₪50,000 in S&P 500 for 20 years"
→ classify: resolved
Agent: brief confirmation, no questions.
Output: { allocations: [{ name: "S&P 500", percentage: 100 }] }
```

**`resolved` — explicit split with pre-stated buffer**
```
goal: "70% FTSE All-World and 30% TLV-125, קרן כספית for buffer"
→ classify: resolved
Agent: brief confirmation, no questions.
Output: { allocations: [{ name: "FTSE All-World", percentage: 70 }, { name: "TLV-125", percentage: 30 }], preStatedBuffer: "קרן כספית" }
```

**`split_missing` — two instruments, no split**
```
goal: "FTSE All-World and TLV-125, ₪80,000"
→ classify: split_missing
Agent: "What percentage in each — 70/30, 80/20, something else?"
User: "70/30"
Output: { allocations: [{ name: "FTSE All-World", percentage: 70 }, { name: "TLV-125", percentage: 30 }] }
```

**`no_specific_instrument` — tech direction**
```
goal: "I want something in tech, ₪30,000, 15 years"
→ classify: no_specific_instrument
Agent: "For tech exposure, NASDAQ-100 (~18%/yr last decade) is the broadest option —
100 large-cap US tech companies. If you want something more concentrated in a specific
sector (e.g., semiconductors), a sector ETF is an option but carries steeper concentration
risk. Does NASDAQ-100 fit, or were you thinking of something more specific?"
User: "NASDAQ-100 sounds right."
Output: { allocations: [{ name: "NASDAQ-100", percentage: 100 }] }
```

**`no_specific_instrument` — global direction, multi-turn**
```
goal: "something global, ₪100,000, 20 years"
→ classify: no_specific_instrument
Agent: "Two main global options: FTSE All-World (~10%/yr) covers US, Europe, Japan,
China, India and more — widest diversification. MSCI World (~11%/yr) is the same but
drops emerging markets, removing EM drag. Which feels right?"
User: "FTSE All-World — but can I add some Israeli exposure too?"
Agent: "FTSE + TLV-125 is a common combination for Israeli investors. What split — 70/30, 80/20?"
User: "80/20."
Output: { allocations: [{ name: "FTSE All-World", percentage: 80 }, { name: "TLV-125", percentage: 20 }] }
```

**`no_equity_stated` — typical beginner**
```
goal: "I want to start investing, I have ₪60,000 and about 25 years"
→ classify: no_equity_stated
Agent: presents all anchors with returns, trade-offs, and a ₪60,000/25yr compounding example.
User: "FTSE All-World sounds right but I want some Israeli exposure too."
Agent: "FTSE + TLV-125 is a clean combination. What split — 70/30, 80/20?"
User: "70/30."
Output: { allocations: [{ name: "FTSE All-World", percentage: 70 }, { name: "TLV-125", percentage: 30 }] }
```

#### Unit test (decided)

No dedicated unit test for 5a beyond Phase 8's orchestrator test. Behavior verified through evals.

#### Resolved — risk/instrument mismatch

Previously open. **Resolved by the introduction of Phase 4b (allocation).** The concern was: a conservative user naming NASDAQ-100 upfront would end up over-exposed. With allocation sizing upstream, this is no longer a behavioral harm: a conservative user lands at (e.g.) 40% equity regardless of which equity instrument fills that bucket. NASDAQ-100 at 40% of portfolio has the same total drawdown exposure as broad-market at 40%. The mismatch concern dissolves into "user's preferred instrument for their sized equity bucket" — which is exactly what Phase 5a is for.

Rejected options kept for record:
- `resolved_with_risk_mismatch` classification branch — no longer needed.
- `reconcileGoal` conditional phase — no longer needed.
- Reconcile-in-risk-phase — still rejected; would break risk's purely-behavioral mandate.

#### Files

- `src/server/pipeline/stages/clarify/equity/clarify.equity.ts` — `collectEquity`: routing logic, focused prompts, extraction
- `src/server/pipeline/stages/clarify/equity/clarify.equity.classify.ts` — `classifyEquityIntent`: lightweight LLM classifier
- `src/server/pipeline/stages/clarify/equity/clarify.equity.rules.md` — behavioral rules per classification case
- `src/server/pipeline/stages/clarify/equity/clarify.equity.eval.ts` — eval cases covering all 4 classification cases, conservative warning, pre-stated buffer capture
- `src/server/pipeline/stages/clarify/shared/clarify.schemas.ts` — replace `PreferencesPhaseOutputSchema` with `EquityAllocationSchema` + `EquityPhaseOutputSchema`

**Verify:** `npm run test:evals -- clarify.equity.eval.ts`.

---

### Phase 5b — Create the buffer phase (split from preferences)

**What:** New dedicated `collectBuffer` phase resolving the user's non-equity buffer preference. Receives `preStatedBuffer` from phase 5a; skips its conversation loop when present.

#### Directory

New directory `clarify/buffer/`:
- `clarify/buffer/clarify.buffer.ts`
- `clarify/buffer/clarify.buffer.rules.md`
- `clarify/buffer/clarify.buffer.eval.ts`
- `clarify/buffer/clarify.buffer.test.ts` — unit test for `preStatedBuffer` early-exit

#### Signature

```ts
export const collectBuffer = async (
  goal: string,
  fields: FieldsPhaseOutput,
  risk: RiskPhaseOutput,
  allocation: AllocationPhaseOutput,
  equity: EquityPhaseOutput,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<BufferPhaseOutput>
```

Phase 8 call site: `collectBuffer(activeGoal, fieldsOutput, riskOutput, allocationOutput, equityOutput, sendToUser, waitForResponse)`.

**Scope boundary:** Phase 5b resolves **which buffer instrument** fills the buffer bucket. The buffer percentage is already sized by Phase 4b and passed as grounding ("you've chosen X% of your portfolio as a stable buffer — what goes in it?").

#### Output schema

```ts
type BufferPhaseOutput = {
  buffer: string;  // self-describing — e.g. "קרן כספית" or
                   // "no buffer — emergency fund held separately" or
                   // "AGGU bonds"
};
```

**Why string, not structured:** variance is low (קרן כספית, no-buffer, occasional bonds/AGGU) and downstream consumers don't iterate it. If research/plan stages later need structure (e.g., ticker lookup), revisit. Keeps the phase simple for now.

#### Context string format

```
User goal: <goal>
Investment amount: ₪<fields.amount>
Risk tolerance: <risk.riskTolerance>
Buffer portion of portfolio: <allocation.bufferPercentage>% (₪<fields.amount × allocation.bufferPercentage / 100>)
Equity allocation (the other <allocation.equityPercentage>%): <equity.allocations formatted as "70% FTSE All-World, 30% TLV-125">
```

#### Early-exit branch

If `equity.preStatedBuffer` is present → return `{ buffer: equity.preStatedBuffer }` directly. No LLM calls, no `sendToUser`, no conversation loop. Covered by a unit test.

#### Decision Logic (when `preStatedBuffer` absent)

```
Step 1 — Buffer not yet discussed → explain קרן כספית (Israeli money market fund,
shekel-denominated, ~4–5% yield, capital-stable, no currency risk) and ask if the
user is comfortable using it for the non-equity portion, or has a different preference.

Step 2 — Explicit decline ("no buffer", "emergency fund outside this portfolio")
→ accept without pushback. Done.

Step 3 — Simple confirmation ("Yes", "sounds good", "קרן כספית is fine")
→ resolved. No follow-up questions.

Step 4 — Named alternative (bonds, AGGU) → capture and accept. Done.
```

#### Conversation principles

- Same conversational principle as 5a: answer mid-conversation follow-up questions fully (e.g., "What's the benefit of קרן כספית vs cash?") before expecting a decision.
- Do not push back on decline or on named alternatives.

#### Unit test (decided)

One unit test for the `preStatedBuffer` early-exit branch (assert no `sendToUser` call, assert `buffer` === `equity.preStatedBuffer`). Rest of behavior verified through evals.

#### Files

- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.ts` — new
- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.rules.md` — new
- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.eval.ts` — new (cases: full flow with mid-conversation Q&A, decline, named alternative, early-exit via pre-stated buffer)
- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.test.ts` — new (early-exit branch)
- `src/server/pipeline/stages/clarify/shared/clarify.schemas.ts` — add `BufferPhaseOutputSchema`

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.buffer.eval.ts`.

---

### Phase 6 — Refactor extraction to thin assembly

**What:** Change `extractUserProfile` to:
```ts
(
  goal: string,
  fields: FieldsPhaseOutput,
  risk: RiskPhaseOutput,
  allocation: AllocationPhaseOutput,
  equity: EquityPhaseOutput,
  buffer: BufferPhaseOutput,
): Promise<UserProfile>
```

The only remaining LLM call: generate the `goal` summary string from the `goal` param (plus grounding context from the other structured inputs). Everything else is assembled directly:
- Copy `amount`, `age`, `timeline`, `hasEmergencyFund`, `hasDebt` from `fields`. (Note: `knowledgeLevel` is no longer collected; `monthlyContribution` moved to `plansToContribute` earlier in the refactor.)
- Copy `plansToContribute` from `contribution`.
- Copy `riskTolerance` from `risk`.
- Copy `equityPercentage` and `bufferPercentage` from `allocation`.
- Copy `equity: equity.allocations` onto the profile (flat — see schema change below).
- Copy `buffer: buffer.buffer` onto the profile.
- Drop `brokerage` from `UserProfileSchema`.

Strip the `EXTRACTION_SYSTEM_PROMPT` to a minimal "generate a concise goal summary" prompt. Delete all riskTolerance derivation rules, secondary signal logic, and behavioral signal examples.

Move short prompt to `clarify.extraction.rules.md`.

#### UserProfile schema change

Replace the old `investmentPreferences: string` field with flat, phase-aligned fields reflecting the full post-refactor pipeline:

```ts
UserProfileSchema = {
  // ... unchanged fields (amount, age, timeline, hasEmergencyFund, hasDebt, goal)
  riskTolerance: RiskTolerance;       // from phase 4
  equityPercentage: number;           // from phase 4b (allocation) — 0–100
  bufferPercentage: number;           // from phase 4b (allocation) — 100 - equityPercentage
  equity: EquityAllocation[];         // from phase 5a — within-equity split
  buffer: string;                     // from phase 5b
  plansToContribute: boolean;         // from phase 3b (contribution)
  // brokerage removed, knowledgeLevel already removed earlier in refactor
};
```

**Why flat, not nested under `investmentPreferences`:** the rest of `UserProfile` is flat. The old nested container was an accident of the monolithic preferences phase. Flattening gives 1:1 phase→field mapping (`collectAllocation` → `profile.equityPercentage`/`bufferPercentage`; `collectEquity` → `profile.equity`; `collectBuffer` → `profile.buffer`) and consistency with the rest of the schema.

**Computing total-portfolio exposure:** downstream consumers (research, plan) that need per-instrument portfolio percentages compute them as `equityPercentage × equity[i].percentage / 100`. Kept as a derived view rather than a stored field to avoid denormalization drift.

**Files:**
- `src/server/pipeline/stages/clarify/extraction/clarify.extraction.ts`
- `src/server/pipeline/stages/clarify/extraction/clarify.extraction.rules.md` — new
- `src/server/pipeline/stages/clarify/extraction/clarify.extraction.eval.ts` — update to pass structured inputs; remove brokerage and secondary-signal cases; assert on `equityPercentage`, `bufferPercentage`, `equity: EquityAllocation[]`, `buffer: string` instead of `investmentPreferences`
- `src/server/schemas/pipeline.schema.ts` — remove `brokerage`; replace `investmentPreferences` with flat `equityPercentage`, `bufferPercentage`, `equity: EquityAllocationSchema[]`, `buffer: z.string()`

**Watch:** Removing `brokerage` and changing `investmentPreferences` → `equityPercentage` + `bufferPercentage` + `equity` + `buffer` has downstream blast radius. Grep for all `UserProfile` consumers (research stage, profile summary builders, plan stage, any logging) — fix references to `.brokerage` and `.investmentPreferences`. Do this grep **before** starting Phase 6 so the full scope is known.

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.extraction.eval.ts`.

---

### Phase 7 — Intake cleanup: drop contradictory, update out-of-scope and unrealistic

**What:** Three targeted changes.

**7a — Drop contradictory:**
- Delete `intake/contradictory/clarify.contradictory.ts` and `intake/contradictory/clarify.contradictory.eval.ts`.
- Remove `contradictory` from `GoalClassification` enum in `pipeline.schema.ts`.
- Update classifier prompt in `clarify.classify.ts` (remove contradictory case; these goals now classify as `normal`).
- Remove `contradictory` entry from `INTAKE_REJECTION_MESSAGES` in constants.
- Remove `contradictory` handler from orchestrator import list.

**7b — Update out-of-scope prompt:**
New content per spec: explain concentration risk vs. diversification, offer sector ETF as middle ground, end with explicit yes/no. Add eval cases: multi-turn acceptance, ambiguous then accepted, partial acceptance with crypto, hard rejection.

**7c — Update unrealistic prompt:**
New content per spec: compute implied annualized return from stated goal (no fixed threshold), use rule of 72 for achievable illustration. Add eval cases: challenge then accepts, ambiguous then accepted, hard rejection.

**7d — Clean goal string extraction from intake handlers:**
After the user accepts the ETF redirect (out-of-scope or unrealistic), make a lightweight LLM extraction call to produce a clean, structured goal string — e.g. `"I want to invest ₪30,000 for 10 years via ETFs"`. Return this as `redirectedGoal` and pass it to `collectFields` instead of the original raw goal.

**Why this matters:** The original goal may contain conflicting statements, vague language, or scope-rejected content (e.g. "I want to invest in NVIDIA stocks but I'm open to ETFs"). `collectFields` and downstream phases (risk, contribution, equity, buffer) all receive `goal` as an explicit param — if the goal is noisy, it pollutes all phases. The clean goal ensures the equity phase's four-tier step-1 evaluation (and the equity extraction's `preStatedBuffer` capture) is based on clean signal, not rejected content.

**Implementation:** Each intake handler (`clarify.out-of-scope.ts`, `clarify.unrealistic.ts`) gains a post-acceptance extraction call:
```ts
const redirectedGoal = await extractCleanGoal(conversation); // lightweight LLM call
return { accepted: true, redirectedGoal };
```
The orchestrator passes `redirectedGoal ?? goal` to `collectFields`.

**Files:**
- `src/server/pipeline/stages/clarify/intake/out-of-scope/clarify.out-of-scope.ts` — add post-acceptance extraction
- `src/server/pipeline/stages/clarify/intake/unrealistic/clarify.unrealistic.ts` — add post-acceptance extraction
- `src/server/pipeline/stages/clarify/clarify.stage.ts` — pass `redirectedGoal ?? goal` to `collectFields`

**Verify:** `npm run test:evals -- clarify.classify.eval.ts` (contradictory goals should now classify as `normal`). Run out-of-scope and unrealistic evals.

**Files (full list):**
- `src/server/pipeline/stages/clarify/intake/contradictory/clarify.contradictory.ts` — delete
- `src/server/pipeline/stages/clarify/intake/contradictory/clarify.contradictory.eval.ts` — delete
- `src/server/pipeline/stages/clarify/intake/classify/clarify.classify.ts` — update prompt, update `GoalClassification` import
- `src/server/schemas/pipeline.schema.ts` — remove `contradictory` from enum
- `src/server/pipeline/stages/clarify/shared/clarify.constants.ts` — remove contradictory rejection message, update `GOAL_CLASSIFICATIONS`
- `src/server/pipeline/stages/clarify/intake/out-of-scope/clarify.out-of-scope.ts` — updated prompt + post-acceptance extraction
- `src/server/pipeline/stages/clarify/intake/out-of-scope/clarify.out-of-scope.eval.ts` — new eval cases
- `src/server/pipeline/stages/clarify/intake/unrealistic/clarify.unrealistic.ts` — updated prompt + post-acceptance extraction
- `src/server/pipeline/stages/clarify/intake/unrealistic/clarify.unrealistic.eval.ts` — new eval cases

---

### Phase 8 — Wire new pipeline in `clarify.stage.ts`

**Intake→fields context gap (decided during Phase 3):** When a user goes through an intake redirect (out-of-scope, unrealistic) and provides financial details during that conversation, `collectFields` starts fresh from the original goal and will re-ask for those fields. This is intentional — intake's sole job is to confirm the user is willing to proceed with ETF investing, not to gather investment data. The UX regression (re-asking already-stated fields) is acceptable for now. The clean goal string extraction in Phase 7d addresses this by passing a clean `redirectedGoal` to `collectFields`.

**What:** Replace the responseId-chaining orchestration with typed I/O:

```ts
const classification = await classifyGoal(goal);
// handle out_of_scope, unrealistic intake (same as before, minus contradictory)
// each intake handler now returns redirectedGoal (Phase 7d)

const activeGoal = redirectedGoal ?? goal;
const fieldsOutput = await collectFields(activeGoal, sendToUser, waitForResponse);
const riskOutput = await collectRisk(activeGoal, fieldsOutput, sendToUser, waitForResponse);
const allocationOutput = await collectAllocation(activeGoal, fieldsOutput, riskOutput, sendToUser, waitForResponse);
const contributionOutput = await collectContribution(activeGoal, fieldsOutput, sendToUser, waitForResponse);
const equityOutput = await collectEquity(activeGoal, fieldsOutput, riskOutput, allocationOutput, contributionOutput, sendToUser, waitForResponse);
const bufferOutput = await collectBuffer(activeGoal, fieldsOutput, riskOutput, allocationOutput, equityOutput, sendToUser, waitForResponse);
const profile = await extractUserProfile(activeGoal, fieldsOutput, riskOutput, allocationOutput, equityOutput, bufferOutput);
```

**Phase ordering rationale:** `collectAllocation` runs immediately after `collectRisk` because allocation is the direct behavioral continuation of risk classification (sizing the equity bucket to tolerance). `collectContribution` is independent of allocation — it sits before equity/buffer since both downstream phases may want to frame periodic contribution in the conversation, but it doesn't feed allocation's factor table.

Remove:
- All `PhaseSourceParams` intermediate variables.
- `buildSourceParams` import (check if still used anywhere; if not, delete `src/lib/build-source-params.ts`).
- `contradictory` handler import.

**Files:**
- `src/server/pipeline/stages/clarify/clarify.stage.ts`
- `src/server/pipeline/stages/clarify/clarify.stage.test.ts` — rewrite: drop per-phase mocks (`collectFields`, `collectEquity`, `collectBuffer`, etc.) and mock `callOpenAI`/`callOpenAIParsed` at the boundary instead. This tests the orchestrator's actual coordination logic end-to-end without bypassing phase implementations.
- `src/lib/build-source-params.ts` — delete if no other importers remain (grep first)

**Verify:** `npm run type-check` (removes all `@ts-expect-error` markers added during phases 3–7), `npm test`, `npm run test:evals -- clarify.stage.eval.ts`.

---

### Phase 9 — Eval alignment pass

**What:** Final sweep of all clarify eval files to ensure they use new typed I/O, remove obsolete assertions, and add missing cases per spec.

Checklist:
- `clarify.fields.eval.ts` — add `monthlyContribution: 0` case (vague then ₪0, explicit ₪0 on first ask)
- `clarify.equity.eval.ts` — add `monthlyContribution: 0` / lump-sum framing case, verify riskTolerance framing cases, verify structured `allocations` output
- `clarify.buffer.eval.ts` — verify early-exit via `preStatedBuffer` and full-flow cases
- `clarify.extraction.eval.ts` — remove all secondary-signal riskTolerance cases (they belong in the risk eval now), remove brokerage assertions, update to assert on flat `equity` + `buffer` fields (no `investmentPreferences`)
- `clarify.stage.eval.ts` — remove brokerage assertions, update to new `equity`/`buffer` field shape, verify end-to-end with new phase sequence

**Files:**
- All five eval files above

**Verify:** `npm run test:evals` — full suite passes.

---

### Phase 10 — Rules files for remaining phases (classify, intake)

**What:** Move inline prompts from `clarify.classify.ts`, `clarify.out-of-scope.ts`, and `clarify.unrealistic.ts` into co-located `.rules.md` files (if not already done in phase 7). No behavior changes — purely structural.

**Files:**
- `src/server/pipeline/stages/clarify/intake/classify/clarify.classify.rules.md` — new
- `src/server/pipeline/stages/clarify/intake/out-of-scope/clarify.out-of-scope.rules.md` — new (if not extracted in phase 7)
- `src/server/pipeline/stages/clarify/intake/unrealistic/clarify.unrealistic.rules.md` — new (if not extracted in phase 7)
- Corresponding `.ts` files updated to import from rules files

**Verify:** `npm run type-check` passes. All previously-passing tests still pass.

---

## Deferred Enhancements

These are not part of the current refactor phases but were identified during Phase 5 design and should be implemented after Phase 10 completes.

### A — Hint/example at start of conversation

**What:** Before the first `ask_user` call in the clarify stage (either in the intake classifier or at the start of `collectFields`), give the user a brief framing message that sets expectations and aligns their first input. For example:

> "To get started, tell me your investment goal — including how much you want to invest, your timeline, and any preferences you have. For example: 'I have ₪50,000, want to invest for 20 years, maybe something global.'"

**Why this matters:** Without a hint, many users open with a vague or incomplete statement ("I want to invest"). The hint reduces unnecessary clarification turns in `collectFields` and — more importantly — reduces cases where the user mentions investment preferences in the goal in an incomplete way (e.g., "something safe") that triggers ambiguous step-1 evaluation in the equity phase. A well-formed goal flowing into `collectFields` improves quality across all downstream phases.

**Design considerations:**
- The hint should be delivered as a user-facing message before any question is asked, not as part of the system prompt.
- It must not feel robotic or form-like — keep it conversational.
- The hint is NOT a required input format; it is a suggestion. Users can still respond however they like.
- Placement: either a one-time message at the very start of `runClarifyStage`, or integrated into the intake classification step before the classifier decides the path.

**Files (when implementing):**
- `src/server/pipeline/stages/clarify/clarify.stage.ts` — add opening message before phase sequence
- OR `src/server/pipeline/stages/clarify/intake/classify/clarify.classify.ts` — integrate into classifier opening

---

### B — Goal context gap after intake redirect (Phase 7d follow-up)

Phase 7d adds clean goal extraction to intake handlers. If the extracted `redirectedGoal` quality proves poor in practice, a more robust fallback is to have the intake handler return a structured summary of what was discussed (amount, timeline, any preferences mentioned) so `collectFields` can skip re-asking already-stated information. Deferred until Phase 7d is live and eval results show whether the lightweight extraction is sufficient.
