# Project Status

## Task Queue

| # | Task |
|---|------|
| T3.5 | Drop `age`, rename `fields` → `parameters` |
| T3.6 | Align `IntakePhaseOutput` to `{ status: "accepted" \| "rejected" }` pattern |
| T4 | Equity |
| T5 | Buffer |
| T6 | Wire equity/buffer in orchestrator |

## Task Notes

### T3.5 — Drop `age`, rename `fields` → `parameters`

**Summary:** T3 removed EF/debt and `age` from the fields phase, leaving it collecting only `amount` and `timeline`. `fields` is now too generic a name — rename to `parameters`, which reflects that these are the two input parameters that drive everything downstream.

**Why now (after T3):** T3 left the phase in a transitional state. This task completes the cleanup with a clean boundary.

**Blast radius (to assess when planning):** schema, types, phase file + directory rename, prompt + extraction instructions, rules file, eval file, runs/last-run files, imports across the pipeline.

### T4 — Equity

Resolves which equity instruments fill the equity bucket and how they split within it. Does not negotiate the equity percentage — that is allocation's job. `allocation.equityPercentage` is passed as grounding context.

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

`preStatedBuffer` is captured when the user volunteers buffer info during the equity conversation. T5 skips its conversation loop when present.

Add `EquityAllocationSchema` + `EquityPhaseOutputSchema` to `clarify/shared/clarify.schemas.ts`. Add `equity: EquityAllocation[]` to `UserProfileSchema`.

#### Architecture: classify-then-route

`classifyEquityIntent` runs once at the start and returns one of four classifications:

| Case | Condition |
|------|-----------|
| `resolved` | 1 instrument named (implied 100%) OR explicit percentage split stated |
| `split_missing` | 2+ instruments named, no percentages |
| `no_specific_instrument` | Direction signaled ("tech", "global") but no specific instrument named |
| `no_equity_stated` | Nothing stated about equity — primary path for most beginners |

Key decisions:
- A single named instrument is `resolved` at 100% — no complement push.
- TLV-125 is presented as an anchor option in `no_specific_instrument` and `no_equity_stated` prompts only.
- For tech direction: NASDAQ-100 is the primary answer; sector ETFs mentioned as a more concentrated alternative.
- No risk-based instrument filtering — allocation sizing is the behavioral safeguard.

#### Context string format

```
User goal: <goal>
Investment amount: ₪<parameters.amount>
Investment timeline: <parameters.timeline>
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

### T5 — Buffer

Resolves which instrument fills the buffer bucket. Receives `preStatedBuffer` from T4; skips conversation loop when present.

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
Investment amount: ₪<parameters.amount>
Risk tolerance: <risk.riskTolerance>
Buffer portion of portfolio: <allocation.bufferPercentage>% (₪<parameters.amount × allocation.bufferPercentage / 100>)
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

## Improvements

- **Allocation budget exhaustion — typed error + graceful user message.** Catch `InternalError` from `runPhaseLoop()` in `collectAllocation`, re-throw as `AllocationConflictError`; handle in the orchestrator to send a graceful closing message instead of a cold error event. Check current orchestrator error dispatch before implementing.

- **`print_to_user` tool (fire-and-forget).** Add a second tool alongside `ask_user` for sending a terminal message without waiting for a user response. Fixes the class of bugs where a phase sends a closing acknowledgment via `ask_user` and inadvertently waits for input. Requires changes to `ask-user.tool.ts`, `clarify.lib.ts` (`collectToolOutputs` currently rejects non-`ask_user` tools), and all phase prompts + evals that send terminal messages.

- **Hint/example at start of conversation.** Before the first `ask_user` call, send a brief framing message setting expectations and nudging the user toward a well-formed goal. Reduces unnecessary clarification turns in `collectParameters`.
