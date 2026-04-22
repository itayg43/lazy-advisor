# Clarify Stage Refactor Plan

## Context

Replaces responseId-chaining with a **typed I/O pipeline**: each phase produces structured output via a post-loop extraction call and receives plain typed inputs from the orchestrator. New dedicated phases isolate risk, allocation, equity, and buffer. The `contradictory` intake path is dropped. Brokerage is removed from the profile.

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

Phases 1 & 2 are parallel. Phases 3, 6, 7 are parallel once 1 & 2 are done. Phase 4 → 4b → 5a → 5b is a strict chain. Phase 8 gates everything. Phases 9 & 10 are post-integration cleanup.

---

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Expand `clarify/shared/clarify.constants.ts` | Complete |
| 2 | Create typed I/O schemas | Complete |
| 3 | Refactor fields phase to typed I/O | Complete |
| 3b | Create the contribution phase | Complete |
| 4 | Create the risk phase (single-question 1-5 self-rating) | Complete |
| 4b | Create the allocation phase (equity vs. buffer sizing) | Complete — 2-axis risk × timeline anchor, 4 behavioral rules, all evals passing. Not yet wired into `clarify.stage.ts` (Phase 8). |
| 5a | Create the equity phase (split from preferences) | Paused — scope revised; now depends on Phase 4b |
| 5b | Create the buffer phase (split from preferences) | Not started — depends on Phase 4b and 5a |
| 6 | Refactor extraction to thin assembly | Not started |
| 7 | Intake cleanup: drop contradictory, update out-of-scope and unrealistic | Not started |
| 8 | Wire new pipeline in `clarify.stage.ts` | Not started |
| 9 | Eval alignment pass | Not started |
| 10 | Rules files for remaining phases | Not started |

---

## Phases

### Phase 5a — Create the equity phase

**What:** Resolves which equity instruments fill the equity bucket and how they split within it. Does **not** negotiate the equity percentage — that's Phase 4b's job. `allocation.equityPercentage` is passed as grounding context ("you've chosen X% in stocks — which stocks?").

Rename `clarify/preferences/` → `clarify/equity/`.

#### Signature

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

#### Output schema

```ts
type EquityAllocation = {
  name: string;        // canonical for known anchors: "S&P 500", "FTSE All-World",
                       // "MSCI World", "NASDAQ-100", "TLV-125". Free-form for sector ETFs.
  percentage: number;  // integer 0–100; within-equity split (sums to 100)
};

type EquityPhaseOutput = {
  allocations: EquityAllocation[];  // length ≥ 1; sum === 100
  preStatedBuffer?: string;         // incidentally-stated buffer preference, if any
                                    // e.g. "קרן כספית" or "no buffer — emergency fund held separately"
};
```

Zod: `allocations.length >= 1`, each `percentage` integer in [0, 100], sum === 100.

`allocations[].percentage` is the **within-equity split**. Total-portfolio exposure per instrument is `allocation.equityPercentage × allocations[i].percentage / 100` — computed by downstream consumers when needed.

`preStatedBuffer` is captured when the user volunteers buffer info during the equity conversation. Phase 5b skips its conversation loop when present.

Replace `PreferencesPhaseOutputSchema` with `EquityAllocationSchema` + `EquityPhaseOutputSchema` in `clarify/shared/clarify.schemas.ts`.

#### Architecture: classify-then-route

`classifyEquityIntent` (in `clarify.equity.classify.ts`) runs once at the start and returns one of four classifications. Code routes to a focused prompt per classification.

| Case | Condition |
|------|-----------|
| `resolved` | 1 instrument named (implied 100%) OR explicit percentage split stated |
| `split_missing` | 2+ instruments named, no percentages |
| `no_specific_instrument` | Direction signaled ("tech", "global") but no specific instrument named |
| `no_equity_stated` | Nothing stated about equity — primary path for most beginners |

Key decisions:
- A single named instrument (e.g., "S&P 500") is `resolved` at 100% — no complement push.
- `no_equity_stated` is the dominant path for beginners starting with "I want to invest" or "I don't know where to start."
- TLV-125 is presented as an anchor option in `no_specific_instrument` and `no_equity_stated` prompts only — not suggested as a complement when equity is already `resolved`.
- For tech direction: NASDAQ-100 is the primary answer (broad); sector ETFs mentioned as a more concentrated alternative.
- No risk-based instrument filtering. Allocation sizing (Phase 4b) is the behavioral safeguard — instrument presentation is neutral on risk.

#### Conversation principles

- Educational: provide context, trade-offs, and concrete compounding examples using `fields.amount`, `fields.timeline`, and historical return rates. Shekel figures land better than abstract percentages for beginners.
- Ground framing in `allocation.equityPercentage`: "You've chosen 70% of your ₪50,000 in stocks — ₪35,000. Which stocks fill that?"
- Each focused prompt stays under ~40 instructions.

#### Context string format

```
User goal: <goal>
Investment amount: ₪<fields.amount>
Investment timeline: <fields.timeline>
Risk tolerance: <risk.riskTolerance>
Equity portion of portfolio: <allocation.equityPercentage>% (buffer is <allocation.bufferPercentage>%)
Plans to contribute periodically: yes | no (lump-sum investment)
```

#### Files

- `src/server/pipeline/stages/clarify/equity/clarify.equity.ts` — `collectEquity`: routing logic, focused prompts, extraction
- `src/server/pipeline/stages/clarify/equity/clarify.equity.classify.ts` — `classifyEquityIntent`: lightweight LLM classifier
- `src/server/pipeline/stages/clarify/equity/clarify.equity.rules.md`
- `src/server/pipeline/stages/clarify/equity/clarify.equity.eval.ts` — cases covering all 4 classification cases and pre-stated buffer capture
- `src/server/pipeline/stages/clarify/shared/clarify.schemas.ts` — replace `PreferencesPhaseOutputSchema`

**Verify:** `npm run test:evals -- clarify.equity.eval.ts`

---

### Phase 5b — Create the buffer phase

**What:** Resolves which instrument fills the buffer bucket. Receives `preStatedBuffer` from Phase 5a; skips its conversation loop when present.

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

#### Output schema

```ts
type BufferPhaseOutput = {
  buffer: string;  // e.g. "קרן כספית", "no buffer — emergency fund held separately", "AGGU bonds"
};
```

#### Early-exit branch

If `equity.preStatedBuffer` is present → return `{ buffer: equity.preStatedBuffer }` directly, no LLM call. Covered by a unit test.

#### Conversation flow (when `preStatedBuffer` absent)

1. Explain קרן כספית (Israeli money market fund, shekel-denominated, ~4–5% yield, capital-stable, no currency risk). Ask if comfortable using it or has a different preference.
2. Decline ("no buffer", "emergency fund outside this portfolio") → accept without pushback.
3. Simple confirmation → resolved.
4. Named alternative (bonds, AGGU) → capture and accept.

Answer mid-conversation follow-up questions fully before expecting a decision. Do not push back on declines or named alternatives.

#### Context string format

```
User goal: <goal>
Investment amount: ₪<fields.amount>
Risk tolerance: <risk.riskTolerance>
Buffer portion of portfolio: <allocation.bufferPercentage>% (₪<fields.amount × allocation.bufferPercentage / 100>)
Equity allocation (the other <allocation.equityPercentage>%): <equity.allocations formatted as "70% FTSE All-World, 30% TLV-125">
```

#### Files

- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.ts`
- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.rules.md`
- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.eval.ts` — cases: full flow with Q&A, decline, named alternative, early-exit via pre-stated buffer
- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.test.ts` — unit test for early-exit branch
- `src/server/pipeline/stages/clarify/shared/clarify.schemas.ts` — add `BufferPhaseOutputSchema`

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.buffer.eval.ts`

---

### Phase 6 — Refactor extraction to thin assembly

**What:** `extractUserProfile` becomes a thin assembler. The only remaining LLM call generates the `goal` summary string. Everything else is copied directly from phase outputs.

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

Assembly:
- `amount`, `age`, `timeline`, `hasEmergencyFund`, `hasDebt` ← `fields`
- `plansToContribute` ← `contribution`
- `riskTolerance` ← `risk`
- `equityPercentage`, `bufferPercentage` ← `allocation`
- `equity: equity.allocations` ← `equity`
- `buffer: buffer.buffer` ← `buffer`
- Drop `brokerage` from `UserProfileSchema`

Strip `EXTRACTION_SYSTEM_PROMPT` to a minimal "generate a concise goal summary" prompt. Delete all riskTolerance derivation rules and secondary signal logic.

Move short prompt to `clarify.extraction.rules.md`.

#### UserProfile schema change

Replace `investmentPreferences: string` with flat phase-aligned fields:

```ts
UserProfileSchema = {
  // ... unchanged (amount, age, timeline, hasEmergencyFund, hasDebt, goal)
  riskTolerance: RiskTolerance;
  equityPercentage: number;      // 0–100
  bufferPercentage: number;      // 100 - equityPercentage
  equity: EquityAllocation[];    // within-equity split
  buffer: string;
  plansToContribute: boolean;
  // brokerage removed, knowledgeLevel already removed
};
```

Downstream consumers compute total-portfolio per-instrument exposure as `equityPercentage × equity[i].percentage / 100`.

**Blast radius:** grep for all `UserProfile` consumers (research, plan, profile summary, logging) before starting. Fix all references to `.brokerage` and `.investmentPreferences`.

#### Files

- `src/server/pipeline/stages/clarify/extraction/clarify.extraction.ts`
- `src/server/pipeline/stages/clarify/extraction/clarify.extraction.rules.md` — new
- `src/server/pipeline/stages/clarify/extraction/clarify.extraction.eval.ts` — update to pass structured inputs; remove brokerage and secondary-signal cases; assert on flat `equity` + `buffer` fields
- `src/server/schemas/pipeline.schema.ts` — remove `brokerage`; replace `investmentPreferences` with flat fields

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.extraction.eval.ts`

---

### Phase 7 — Intake cleanup

**7a — Drop contradictory:**
- Delete `intake/contradictory/clarify.contradictory.ts` and `clarify.contradictory.eval.ts`.
- Remove `contradictory` from `GoalClassification` enum in `pipeline.schema.ts`.
- Update classifier prompt (contradictory goals now classify as `normal`).
- Remove `contradictory` entry from `INTAKE_REJECTION_MESSAGES`.

**7b — Update out-of-scope prompt:** explain concentration risk vs. diversification, offer sector ETF as middle ground, end with explicit yes/no. Add eval cases: multi-turn acceptance, ambiguous then accepted, partial acceptance with crypto, hard rejection.

**7c — Update unrealistic prompt:** compute implied annualized return from the stated goal (no fixed threshold), use rule of 72 for achievable illustration. Add eval cases: challenge then accepts, ambiguous then accepted, hard rejection.

**7d — Clean goal extraction after intake redirect:** after a user accepts the ETF redirect, make a lightweight LLM call to produce a clean structured goal string (e.g. `"I want to invest ₪30,000 for 10 years via ETFs"`). Return as `redirectedGoal`; orchestrator passes `redirectedGoal ?? goal` to `collectFields`. This prevents noisy or conflicting intake content from polluting all downstream phases.

```ts
const redirectedGoal = await extractCleanGoal(conversation);
return { accepted: true, redirectedGoal };
```

#### Files

- `src/server/pipeline/stages/clarify/intake/contradictory/clarify.contradictory.ts` — delete
- `src/server/pipeline/stages/clarify/intake/contradictory/clarify.contradictory.eval.ts` — delete
- `src/server/pipeline/stages/clarify/intake/classify/clarify.classify.ts` — update prompt, update `GoalClassification` import
- `src/server/schemas/pipeline.schema.ts` — remove `contradictory` from enum
- `src/server/pipeline/stages/clarify/shared/clarify.constants.ts` — remove contradictory rejection message
- `src/server/pipeline/stages/clarify/intake/out-of-scope/clarify.out-of-scope.ts` — updated prompt + post-acceptance extraction
- `src/server/pipeline/stages/clarify/intake/out-of-scope/clarify.out-of-scope.eval.ts` — new eval cases
- `src/server/pipeline/stages/clarify/intake/unrealistic/clarify.unrealistic.ts` — updated prompt + post-acceptance extraction
- `src/server/pipeline/stages/clarify/intake/unrealistic/clarify.unrealistic.eval.ts` — new eval cases

**Verify:** `npm run test:evals -- clarify.classify.eval.ts` (contradictory goals → `normal`). Run out-of-scope and unrealistic evals.

---

### Phase 8 — Wire new pipeline in `clarify.stage.ts`

```ts
const classification = await classifyGoal(goal);
// handle out_of_scope, unrealistic (each now returns redirectedGoal via Phase 7d)

const activeGoal = redirectedGoal ?? goal;
const fieldsOutput      = await collectFields(activeGoal, sendToUser, waitForResponse);
const riskOutput        = await collectRisk(activeGoal, fieldsOutput, sendToUser, waitForResponse);
const allocationOutput  = await collectAllocation(activeGoal, fieldsOutput, riskOutput, sendToUser, waitForResponse);
const contributionOutput = await collectContribution(activeGoal, fieldsOutput, sendToUser, waitForResponse);
const equityOutput      = await collectEquity(activeGoal, fieldsOutput, riskOutput, allocationOutput, contributionOutput, sendToUser, waitForResponse);
const bufferOutput      = await collectBuffer(activeGoal, fieldsOutput, riskOutput, allocationOutput, equityOutput, sendToUser, waitForResponse);
const profile           = await extractUserProfile(activeGoal, fieldsOutput, riskOutput, allocationOutput, equityOutput, bufferOutput);
```

`collectAllocation` runs immediately after `collectRisk` — allocation is the direct behavioral continuation of risk classification. `collectContribution` is independent of allocation and runs before equity/buffer so downstream phases can frame periodic contribution in conversation.

Remove: all `PhaseSourceParams` intermediate variables, `buildSourceParams` import (delete `src/lib/build-source-params.ts` if no other importers — grep first), `contradictory` handler import.

**Note on intake→fields context gap:** when a user provides financial details during an intake redirect conversation, `collectFields` will re-ask for those fields — intake's sole job is confirming willingness to proceed with ETF investing, not gathering investment data. The `redirectedGoal` from Phase 7d partially mitigates this.

#### Files

- `src/server/pipeline/stages/clarify/clarify.stage.ts`
- `src/server/pipeline/stages/clarify/clarify.stage.test.ts` — rewrite: mock `callOpenAI`/`callOpenAIParsed` at the boundary instead of per-phase mocks
- `src/lib/build-source-params.ts` — delete if no other importers (grep first)

**Verify:** `npm run type-check` (removes all `@ts-expect-error` markers added during phases 3–7), `npm test`, `npm run test:evals -- clarify.stage.eval.ts`

---

### Phase 9 — Eval alignment pass

Final sweep of all clarify eval files.

Checklist:
- `clarify.fields.eval.ts` — add `monthlyContribution: 0` case (vague then ₪0, explicit ₪0 on first ask)
- `clarify.equity.eval.ts` — add lump-sum framing case, verify riskTolerance framing cases, verify structured `allocations` output
- `clarify.buffer.eval.ts` — verify early-exit via `preStatedBuffer` and full-flow cases
- `clarify.extraction.eval.ts` — remove secondary-signal riskTolerance cases, remove brokerage assertions, assert on flat `equity` + `buffer` fields
- `clarify.stage.eval.ts` — remove brokerage assertions, update to new `equity`/`buffer` field shape, verify end-to-end with new phase sequence

**Verify:** `npm run test:evals` — full suite passes.

---

### Phase 10 — Rules files for remaining phases

Move inline prompts from `clarify.classify.ts`, `clarify.out-of-scope.ts`, and `clarify.unrealistic.ts` into co-located `.rules.md` files (if not already done in Phase 7). No behavior changes.

#### Files

- `src/server/pipeline/stages/clarify/intake/classify/clarify.classify.rules.md` — new
- `src/server/pipeline/stages/clarify/intake/out-of-scope/clarify.out-of-scope.rules.md` — new (if not extracted in Phase 7)
- `src/server/pipeline/stages/clarify/intake/unrealistic/clarify.unrealistic.rules.md` — new (if not extracted in Phase 7)

**Verify:** `npm run type-check` passes. All previously-passing tests still pass.

---

## Deferred Enhancements

### A — Hint/example at start of conversation

Before the first `ask_user` call, send a brief framing message setting expectations and nudging the user toward a well-formed goal (amount, timeline, any preferences). Reduces unnecessary clarification turns in `collectFields` and improves downstream phase quality.

Placement: either a one-time message at the start of `runClarifyStage`, or integrated into the intake classification step.

### B — Goal context gap after intake redirect

If Phase 7d's `redirectedGoal` quality proves poor in practice, a stronger fallback is having the intake handler return a structured summary of what was discussed (amount, timeline, preferences) so `collectFields` can skip re-asking already-stated information. Deferred until Phase 7d eval results are known.
