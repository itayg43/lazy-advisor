# Tasks

**Current task:** T3.9
**Next task:** T3.7

## Task Queue

| # | Task |
|---|------|
| T3.7 | Hard-fail on missing timeline (same pattern as `amount_missing`) |
| T3.8 | Hard-fail on unresolved risk tolerance (remove silent conservative default) |
| T3.9 | Migrate allocation to status pattern; introduce `PhaseBudgetExhaustedError`; rename `clarify.lib.ts` → `clarify.phase.ts` |
| T4 | Refactor risk + contribution to `askWithClassify` |
| T5 | Equity |
| T6 | Buffer |

## Task Notes

### T3.7 — Parameters: hard-fail on missing timeline

Currently, rule 2 of the parameters phase accepts "best available" on the second timeline attempt — if the user is still vague, the extraction silently maps it to a bucket with no documented fallback value. Timeline is one of the two axes of the allocation anchor table and determines the short-horizon exit; a wrong timeline produces a wrong plan. Same principle as amount: if we cannot collect it reliably, abort rather than proceed on a guess.

**Changes:**
- `ParametersExtractionSchema` — add `nullable()` to `timeline` (mirrors `amount`)
- `ParametersPhaseResultSchema` — add `code: "timeline_missing"` to the failure union
- Parameters prompt — change rule 2: on second vague/missing timeline response, end the phase (same two-try rule as amount, not "accept best available")
- `clarify.parameters.rules.md` — update rule 2 and rule 4 to cover timeline failure
- `clarify.stage.ts` — handle `timeline_missing`: add `TIMELINE_EXIT_MESSAGE` constant, send message, return null
- ARCHITECTURE.md — add timeline failure exit node to flowchart
- Eval — add case for `timeline_missing`

**Files:**
- `src/server/pipeline/stages/clarify/parameters/clarify.parameters.ts`
- `src/server/pipeline/stages/clarify/shared/clarify.schemas.ts`
- `src/server/pipeline/stages/clarify/parameters/clarify.parameters.rules.md`
- `src/server/pipeline/stages/clarify/parameters/clarify.parameters.eval.ts`
- `src/server/pipeline/stages/clarify/clarify.stage.ts`
- `documentation/ARCHITECTURE.md`

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.parameters.eval.ts`

---

### T3.8 — Risk: hard-fail on unresolved risk tolerance

Currently, if the user cannot give a 1–5 score after two attempts, the extraction defaults to `selfRatingScore: 1` → `conservative`. This is a silent fallback that builds the plan on an assumed value. Risk tolerance is the other axis of the allocation anchor table; an assumed value produces a misleading allocation. Same principle as T3.7: required profile data must be explicitly collected.

**Note on T4 ordering:** T4 will rewrite `collectRisk` (runPhaseLoop → askWithClassify). Implement T3.8 in the current implementation; T4 carries the hard-fail behavior forward in the new pattern — no rework required.

**Changes:**
- Risk extraction instructions — remove "default to 1"; return null when no valid score given
- `RiskScoreSchema` — make `selfRatingScore` nullable in the extraction schema (new `RiskScoreExtractionSchema`)
- Add `RiskPhaseResultSchema` — discriminated union `{ status: "success", ...RiskPhaseOutput } | { status: "failure", code: "risk_missing" }`
- `collectRisk` — return `RiskPhaseResult` instead of `RiskPhaseOutput`
- `clarify.stage.ts` — handle `risk_missing`: add `RISK_EXIT_MESSAGE` constant, send message, return null
- `clarify.risk.rules.md` — update extraction behavior (no default)
- ARCHITECTURE.md — remove "default-on-unresolved is conservative" note from risk section; add risk failure exit node to flowchart
- Eval — update extraction cases (no default); add failure case

**Files:**
- `src/server/pipeline/stages/clarify/risk/clarify.risk.ts`
- `src/server/pipeline/stages/clarify/shared/clarify.schemas.ts`
- `src/server/pipeline/stages/clarify/shared/clarify.types.ts`
- `src/server/pipeline/stages/clarify/risk/clarify.risk.rules.md`
- `src/server/pipeline/stages/clarify/risk/clarify.risk.eval.ts`
- `src/server/pipeline/stages/clarify/clarify.stage.ts`
- `documentation/ARCHITECTURE.md`

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.risk.eval.ts`

---

### T3.9 — Allocation: migrate to status pattern; rename phase-runner module

The allocation phase currently returns `AllocationPhaseOutput` directly and relies on `runPhaseLoop` to throw `InternalError` when the user can't agree on a split within the tool-call budget. T5 originally proposed catching that as `AllocationConflictError` and re-throwing for the orchestrator. Aligning with parameters/intake/risk (T3.5–T3.8), allocation should model budget exhaustion as an in-band failure status rather than an exception. Reserve `throw` for genuinely unexpected conditions (e.g., model called an unknown tool). Execute before T3.6 — establishes the `PhaseBudgetExhaustedError` and the `clarify.phase.ts` filename used by later tasks.

**Approach:**
- Introduce `PhaseBudgetExhaustedError` in the shared phase runner — replaces the `InternalError` thrown when `toolCallCount > maxToolCalls`. The "unexpected tool call" throw at `collectToolOutputs` stays as `InternalError` (it really is a bug).
- Allocation catches `PhaseBudgetExhaustedError` narrowly and returns `{ status: "failure", code: "split_unresolved" }`. Other callers of `runPhaseLoop` (intake, parameters, risk) are unaffected — none currently surfaces budget exhaustion as a graceful exit, and adding speculative `code` values per phase would be premature.
- Rename `clarify.lib.ts` → `clarify.phase.ts` (the file is a phase runner, not a generic lib). Update imports.

**Changes:**
- `clarify.schemas.ts` — add `AllocationPhaseResultSchema` (discriminated union: `{ status: "success", allocation: AllocationPhaseOutput } | { status: "failure", code: "split_unresolved" }`)
- `clarify.types.ts` — add `AllocationPhaseResult`
- `clarify.lib.ts` → `clarify.phase.ts` — rename file; replace cap-exhaustion `InternalError` throw with new `PhaseBudgetExhaustedError`
- `clarify.allocation.ts` — wrap `runPhaseLoop` call in try/catch; return `AllocationPhaseResult`
- `clarify.stage.ts` — `switch (allocationResult.status)`; on failure, send `ALLOCATION_EXIT_MESSAGE`, return null
- `clarify.constants.ts` — add `ALLOCATION_EXIT_MESSAGE`
- `clarify.allocation.eval.ts` — update assertions for new return shape; add case for budget exhaustion
- T5 Task Notes — remove the `AllocationConflictError` paragraph (now handled by T3.9)
- ARCHITECTURE.md — add allocation failure exit node to flowchart

**Files:**
- `src/server/pipeline/stages/clarify/allocation/clarify.allocation.ts`
- `src/server/pipeline/stages/clarify/allocation/clarify.allocation.eval.ts`
- `src/server/pipeline/stages/clarify/shared/clarify.schemas.ts`
- `src/server/pipeline/stages/clarify/shared/clarify.types.ts`
- `src/server/pipeline/stages/clarify/shared/clarify.lib.ts` → `clarify.phase.ts`
- `src/server/pipeline/stages/clarify/shared/clarify.constants.ts`
- `src/server/pipeline/stages/clarify/clarify.stage.ts`
- `documentation/ARCHITECTURE.md`
- `documentation/TASKS.md` (T5 update)

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.allocation.eval.ts`

---

### T4 — Refactor risk + contribution to `askWithClassify`

The risk and contribution phases each ask a single fixed question and classify the response — the same shape as ef-debt. Both currently use `runPhaseLoop`, which hands the LLM full orchestration control despite not needing it. Migration to `askWithClassify` makes state explicit in TypeScript, reduces unnecessary LLM calls, and tightens eval assertions (no conversation history to manage).

**Sections:**

1. **Risk** — replace `runPhaseLoop` with a fixed 1–5 scale question + `askWithClassify` classifying `{ selfRatingScore: 1 | 2 | 3 | 4 | 5 }`. Post-classification `riskTolerance` derivation stays in TypeScript. Update `clarify.risk.eval.ts`.
2. **Contribution** — replace `runPhaseLoop` with a fixed opening question + `askWithClassify` classifying `{ plansToContribute: boolean }`. Update `clarify.contribution.eval.ts`.

**Files:**
- `src/server/pipeline/stages/clarify/risk/clarify.risk.ts`
- `src/server/pipeline/stages/clarify/contribution/clarify.contribution.ts`
- Evals for both phases

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.risk.eval.ts`, `npm run test:evals -- clarify.contribution.eval.ts`

---

### T5 — Equity

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

`preStatedBuffer` is captured when the user volunteers buffer info during the equity conversation. T6 skips its conversation loop when present.

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

### T6 — Buffer

Resolves which instrument fills the buffer bucket. Receives `preStatedBuffer` from T5; skips conversation loop when present.

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

## Backlog

- **`print_to_user` tool (fire-and-forget).** Add a second tool alongside `ask_user` for sending a terminal message without waiting for a user response. Fixes the class of bugs where a phase sends a closing acknowledgment via `ask_user` and inadvertently waits for input. Requires changes to `ask-user.tool.ts`, `clarify.phase.ts` (`collectToolOutputs` currently rejects non-`ask_user` tools), and all phase prompts + evals that send terminal messages.

  **Also generalize `runPhaseLoop` / `collectToolOutputs` at the same time.** Today `collectToolOutputs` hardcodes the allowed tool name (`ASK_USER_TOOL.name`) and dispatches directly to `handleAskUser`. With a second tool, replace both with a tool-handler registry (`{ [name]: handler }`) keyed by tool name; the loop validates against the registry's keys and dispatches via the map. Two concrete tools provides the second example needed to design the registry shape correctly — doing it speculatively with one tool would just shuffle the hardcode up one level.

- **Hint/example at start of conversation.** Before the first `ask_user` call, send a brief framing message setting expectations and nudging the user toward a well-formed goal. Reduces unnecessary clarification turns in `collectParameters`.
