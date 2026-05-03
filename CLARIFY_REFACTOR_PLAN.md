# Clarify Stage Refactor Plan

## Context

Replaces responseId-chaining with a **typed I/O pipeline**: each phase produces structured output via a post-loop extraction call and receives plain typed inputs from the orchestrator. New dedicated phases isolate risk, allocation, equity, and buffer. Brokerage is removed from the profile.

---

## Tasks

### T3 — EF/debt gate

A new pre-fields suitability step, modeled on the intake rejection pattern. Educates or warns the user about emergency fund and debt before field collection proceeds. `hasEmergencyFund` and `hasDebt` are removed from fields and `UserProfileSchema` — they are not consumed downstream and can be added back if a future consumer requires them.

#### Behavior

1. Ask if the user has an emergency fund and any significant outstanding debt.
2. If either risk is present, educate briefly (why investing without an EF or while carrying high-interest debt is suboptimal) and ask if they want to proceed anyway.
3. Proceed regardless of answer — this is educational, not a hard gate. No rejection path.

#### Files

- `src/server/pipeline/stages/clarify/ef-debt/clarify.ef-debt.ts` — new phase
- `src/server/pipeline/stages/clarify/ef-debt/clarify.ef-debt.rules.md` — new
- `src/server/pipeline/stages/clarify/ef-debt/clarify.ef-debt.eval.ts` — new
- `src/server/pipeline/stages/clarify/shared/clarify.schemas.ts` — remove `hasEmergencyFund`, `hasDebt` from `FieldsPhaseOutputSchema`
- `src/server/schemas/pipeline.schemas.ts` — remove `hasEmergencyFund`, `hasDebt` from `UserProfileSchema`
- `src/server/pipeline/stages/clarify/fields/clarify.fields.ts` — remove EF/debt questions from prompt
- `src/server/pipeline/stages/clarify/fields/clarify.fields.rules.md` — update rules
- `src/server/pipeline/stages/clarify/clarify.stage.ts` — insert `collectEfDebt` call before `collectFields`

`collectEfDebt` returns `void` — it is purely educational with no data flowing downstream, unlike every other phase.

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.ef-debt.eval.ts`

---

### T4 — Phase 5a: equity

Resolves which equity instruments fill the equity bucket and how they split within it. Does not negotiate the equity percentage — that is Phase 4b's job. `allocation.equityPercentage` is passed as grounding context.

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
  name: string; // canonical for known anchors: "S&P 500", "FTSE All-World",
  // "MSCI World", "NASDAQ-100", "TLV-125". Free-form for sector ETFs.
  percentage: number; // integer 0–100; within-equity split (sums to 100)
};

type EquityPhaseOutput = {
  allocations: EquityAllocation[]; // length ≥ 1; sum === 100
  preStatedBuffer?: string; // incidentally-stated buffer preference, if any
};
```

Zod: `allocations.length >= 1`, each `percentage` integer in [0, 100], sum === 100.

`preStatedBuffer` is captured when the user volunteers buffer info during the equity conversation. Phase T5 skips its conversation loop when present.

Add `EquityAllocationSchema` + `EquityPhaseOutputSchema` to `clarify/shared/clarify.schemas.ts`. Add `equity: EquityAllocation[]` to `UserProfileSchema`.

#### Architecture: classify-then-route

`classifyEquityIntent` runs once at the start and returns one of four classifications:

| Case                     | Condition                                                              |
| ------------------------ | ---------------------------------------------------------------------- |
| `resolved`               | 1 instrument named (implied 100%) OR explicit percentage split stated  |
| `split_missing`          | 2+ instruments named, no percentages                                   |
| `no_specific_instrument` | Direction signaled ("tech", "global") but no specific instrument named |
| `no_equity_stated`       | Nothing stated about equity — primary path for most beginners          |

Key decisions:

- A single named instrument is `resolved` at 100% — no complement push.
- TLV-125 is presented as an anchor option in `no_specific_instrument` and `no_equity_stated` prompts only.
- For tech direction: NASDAQ-100 is the primary answer; sector ETFs mentioned as a more concentrated alternative.
- No risk-based instrument filtering — allocation sizing is the behavioral safeguard.

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

- `src/server/pipeline/stages/clarify/equity/clarify.equity.ts`
- `src/server/pipeline/stages/clarify/equity/clarify.equity.classify.ts`
- `src/server/pipeline/stages/clarify/equity/clarify.equity.rules.md`
- `src/server/pipeline/stages/clarify/equity/clarify.equity.eval.ts`
- `src/server/pipeline/stages/clarify/shared/clarify.schemas.ts` — add `EquityAllocationSchema`, `EquityPhaseOutputSchema`
- `src/server/schemas/pipeline.schemas.ts` — add `equity` field

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.equity.eval.ts`

---

### T5 — Phase 5b: buffer

Resolves which instrument fills the buffer bucket. Receives `preStatedBuffer` from T4; skips conversation loop when present.

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
  buffer: string; // e.g. "קרן כספית", "no buffer — emergency fund held separately", "AGGU bonds"
};
```

#### Early-exit branch

If `equity.preStatedBuffer` is present → return `{ buffer: equity.preStatedBuffer }` directly, no LLM call. Covered by a unit test.

#### Conversation flow (when `preStatedBuffer` absent)

1. Explain קרן כספית (Israeli money market fund, shekel-denominated, ~4–5% yield, capital-stable, no currency risk). Ask if comfortable using it or has a different preference.
2. Decline ("no buffer", "emergency fund outside this portfolio") → accept without pushback.
3. Simple confirmation → resolved.
4. Named alternative (bonds, AGGU) → capture and accept.

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
- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.eval.ts`
- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.test.ts` — unit test for early-exit branch
- `src/server/pipeline/stages/clarify/shared/clarify.schemas.ts` — add `BufferPhaseOutputSchema`
- `src/server/schemas/pipeline.schemas.ts` — add `buffer` field

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.buffer.eval.ts`

---

## Deferred Enhancements

### A — Hint/example at start of conversation

Before the first `ask_user` call, send a brief framing message setting expectations and nudging the user toward a well-formed goal. Reduces unnecessary clarification turns in `collectFields`.

### B — `print_to_user` tool (fire-and-forget)

Add a second tool alongside `ask_user` for sending a terminal message without waiting for a user response. Fixes the class of bugs where a phase sends a closing acknowledgment via `ask_user` and inadvertently waits for input. Requires changes to `ask-user.tool.ts`, `clarify.lib.ts`, and all phase prompts + evals that send terminal messages.
