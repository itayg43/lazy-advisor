# Clarify Stage Refactor Plan

## Context

The clarify stage currently chains phases via `previous_response_id` — each phase passes its OpenAI response ID to the next, with a single extraction call at the end reading the full cross-phase conversation. This creates tight coupling, makes phases hard to test in isolation, and buries `riskTolerance` collection inside a bloated fields phase.

The spec (`CLARIFY_REVIEW.md`) redesigns this as a typed I/O pipeline: each phase gets a post-loop extraction call that produces structured output, and phases receive plain typed inputs from the orchestrator. A new dedicated risk phase isolates `riskTolerance` resolution. The `contradictory` intake path is dropped (risk contradiction is now handled naturally by the risk phase). Brokerage is removed from the profile.

---

## Dependency Graph

```
Phase 1 (constants)  ──────────────────────────────────────┐
Phase 2 (schemas)    ─────────────────────────────────┐    │
                                                       ↓    ↓
Phase 3 (fields refactor)  ─────────────────────────► Phase 8 (orchestrator)
Phase 4 (risk phase)  ──────────────────────────────► Phase 8
Phase 5 (preferences refactor)  ────────────────────► Phase 8
Phase 6 (thin extraction)  ─────────────────────────► Phase 8
Phase 7 (intake cleanup)  ──────────────────────────► Phase 8
                                                          │
                                          ┌───────────────┘
                                          ▼
                                   Phase 9 (eval alignment)
                                   Phase 10 (rules files)
```

Phases 1 & 2 are parallel. Phases 3–7 are parallel once 1 & 2 are done. Phase 8 gates everything. Phases 9 & 10 are post-integration cleanup.

---

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Expand `clarify.constants.ts` | Complete |
| 2 | Create typed I/O schemas | Complete |
| 3 | Refactor fields phase to typed I/O | Not started |
| 4 | Create the risk phase | Not started |
| 5 | Refactor preferences phase to typed I/O | Not started |
| 6 | Refactor extraction to thin assembly | Not started |
| 7 | Intake cleanup: drop contradictory, update out-of-scope and unrealistic | Not started |
| 8 | Wire new pipeline in `clarify.stage.ts` | Not started |
| 9 | Eval alignment pass | Not started |
| 10 | Rules files for remaining phases | Not started |

---

## Phases

### Phase 3 — Refactor fields phase to typed I/O

**What:** Change `collectFields` to accept `goalText: string` and return `Promise<FieldsOutput>`.

Internal changes:
1. Constructs `{ input: goalText }` directly — no `buildSourceParams`.
2. Calls `runPhaseLoop` as before.
3. Post-loop: makes a separate `zodTextFormat(FieldsOutputSchema)` extraction call off the loop's `responseId`.
4. Returns `FieldsOutput`.

Prompt changes:
- Remove `riskTolerance` from required fields (moves to risk phase).
- Remove `brokerage` from optional fields (dropped from profile).
- Add `monthlyContribution: 0` rule: on second ask, append "If you're not planning to contribute monthly, ₪0 is a valid answer." After two asks with no specific value, default to `0`.

Move prompt text to `clarify.fields.rules.md`.

**Files:**
- `src/server/pipeline/stages/clarify/fields/clarify.fields.ts`
- `src/server/pipeline/stages/clarify/fields/clarify.fields.rules.md` — new
- `src/server/pipeline/stages/clarify/fields/clarify.fields.test.ts` — update mocks for extraction call; assert `FieldsOutput`
- `src/server/pipeline/stages/clarify/fields/clarify.fields.eval.ts` — update call signature; assert on `FieldsOutput` directly

**Verify:** `npm test` (unit), `npm run test:evals -- clarify.fields.eval.ts`.

---

### Phase 4 — Create the risk phase

**What:** New `collectRisk(amount: number, sendToUser, waitForResponse): Promise<RiskOutput>`.

Two-step resolution flow per spec:
- Turn 1: present A/B scenario from `buildRiskScenario(amount)`. A → conservative (exit), B → proceed to follow-up.
- Follow-up: "Would you find that stressful to watch, or stay pretty calm?" Stressed → moderate, calm → aggressive (exit).
- Educational fallbacks: "I don't know" or market-timing answers get explanation + re-ask (no exit).
- After 3 turns with no clear signal: default to `conservative`.

Post-loop: `zodTextFormat(RiskOutputSchema)` extraction off loop's `responseId`.

Prompt in `clarify.risk.rules.md`. Internal taxonomy (conservative/moderate/aggressive) never shown to user.

**Files:**
- `src/server/pipeline/stages/clarify/risk/clarify.risk.ts` — new
- `src/server/pipeline/stages/clarify/risk/clarify.risk.rules.md` — new
- `src/server/pipeline/stages/clarify/risk/clarify.risk.eval.ts` — new
- `src/server/pipeline/stages/clarify/clarify.constants.ts` — `MAX_RISK_TOOL_CALLS` (if not already added in phase 1)

Eval cases:
- User picks A → conservative
- User picks B then "stressful" → moderate
- User picks B then "calm" → aggressive
- "I don't know" → educational fallback → re-ask → conservative
- Market-timing answer → redirect → picks B + calm → aggressive

**Verify:** `npm run test:evals -- clarify.risk.eval.ts`.

---

### Phase 5 — Refactor preferences phase to typed I/O

**What:** Change `collectPreferences` to accept `{ riskTolerance, amount, timeline }` and return `Promise<PrefsOutput>`.

Internal changes:
1. Constructs initial context from typed input — no `buildSourceParams`.
2. Calls `runPhaseLoop` as before.
3. Post-loop: `zodTextFormat(PrefsOutputSchema)` extraction.
4. Returns `PrefsOutput`.

Prompt changes:
- Import return figures from `BENCHMARK_RETURNS` (no hardcoded numbers).
- Use `riskTolerance` to adjust framing: flag NASDAQ volatility more prominently for conservative users.
- Handle `monthlyContribution: 0`: show lump-sum-only projections, no DCA examples.

Move prompt text to `clarify.preferences.rules.md`.

**Files:**
- `src/server/pipeline/stages/clarify/preferences/clarify.preferences.ts`
- `src/server/pipeline/stages/clarify/preferences/clarify.preferences.rules.md` — new
- `src/server/pipeline/stages/clarify/preferences/clarify.preferences.test.ts` — update mocks; assert `PrefsOutput`
- `src/server/pipeline/stages/clarify/preferences/clarify.preferences.eval.ts` — update call signature with structured input

**Verify:** `npm test` (unit), `npm run test:evals -- clarify.preferences.eval.ts`.

---

### Phase 6 — Refactor extraction to thin assembly

**What:** Change `extractUserProfile` to:
```ts
(fields: FieldsOutput, risk: RiskOutput, prefs: PrefsOutput): Promise<UserProfile>
```

The only remaining LLM call: generate the `goal` summary string. Everything else is assembled directly:
- Copy `amount`, `age`, `timeline`, `knowledgeLevel`, `hasEmergencyFund`, `hasDebt`, `monthlyContribution` from `fields`.
- Copy `riskTolerance` from `risk`.
- Copy `investmentPreferences` from `prefs`.
- Drop `brokerage` from `UserProfileSchema`.

Strip the `EXTRACTION_SYSTEM_PROMPT` to a minimal "generate a concise goal summary" prompt. Delete all riskTolerance derivation rules, secondary signal logic, and behavioral signal examples.

Move short prompt to `clarify.extraction.rules.md`.

**Files:**
- `src/server/pipeline/stages/clarify/extraction/clarify.extraction.ts`
- `src/server/pipeline/stages/clarify/extraction/clarify.extraction.rules.md` — new
- `src/server/pipeline/stages/clarify/extraction/clarify.extraction.eval.ts` — update to pass structured inputs; remove brokerage and secondary-signal cases
- `src/server/schemas/pipeline.schema.ts` — remove `brokerage` field from `UserProfileSchema`

**Watch:** After removing `brokerage`, grep for all `UserProfile` consumers downstream (research stage, profile summary builders) — fix any that reference `.brokerage`.

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.extraction.eval.ts`.

---

### Phase 7 — Intake cleanup: drop contradictory, update out-of-scope and unrealistic

**What:** Three targeted changes.

**7a — Drop contradictory:**
- Delete `intake/clarify.contradictory.ts` and `intake/clarify.contradictory.eval.ts`.
- Remove `contradictory` from `GoalClassification` enum in `pipeline.schema.ts`.
- Update classifier prompt in `clarify.classify.ts` (remove contradictory case; these goals now classify as `normal`).
- Remove `contradictory` entry from `INTAKE_REJECTION_MESSAGES` in constants.
- Remove `contradictory` handler from orchestrator import list.

**7b — Update out-of-scope prompt:**
New content per spec: explain concentration risk vs. diversification, offer sector ETF as middle ground, end with explicit yes/no. Add eval cases: multi-turn acceptance, ambiguous then accepted, partial acceptance with crypto, hard rejection.

**7c — Update unrealistic prompt:**
New content per spec: compute implied annualized return from stated goal (no fixed threshold), use rule of 72 for achievable illustration. Add eval cases: challenge then accepts, ambiguous then accepted, hard rejection.

**Files:**
- `src/server/pipeline/stages/clarify/intake/clarify.contradictory.ts` — delete
- `src/server/pipeline/stages/clarify/intake/clarify.contradictory.eval.ts` — delete
- `src/server/pipeline/stages/clarify/intake/clarify.classify.ts` — update prompt, update `GoalClassification` import
- `src/server/schemas/pipeline.schema.ts` — remove `contradictory` from enum
- `src/server/pipeline/stages/clarify/clarify.constants.ts` — remove contradictory rejection message, update `GOAL_CLASSIFICATIONS`
- `src/server/pipeline/stages/clarify/intake/clarify.out-of-scope.ts` — updated prompt
- `src/server/pipeline/stages/clarify/intake/clarify.out-of-scope.eval.ts` — new eval cases
- `src/server/pipeline/stages/clarify/intake/clarify.unrealistic.ts` — updated prompt
- `src/server/pipeline/stages/clarify/intake/clarify.unrealistic.eval.ts` — new eval cases

**Verify:** `npm run test:evals -- clarify.classify.eval.ts` (contradictory goals should now classify as `normal`). Run out-of-scope and unrealistic evals.

---

### Phase 8 — Wire new pipeline in `clarify.stage.ts`

**What:** Replace the responseId-chaining orchestration with typed I/O:

```ts
const classification = await classifyGoal(goal);
// handle out_of_scope, unrealistic intake (same as before, minus contradictory)

const fieldsOutput = await collectFields(goal, sendToUser, waitForResponse);
const riskOutput = await collectRisk(fieldsOutput.amount, sendToUser, waitForResponse);
const prefsOutput = await collectPreferences(
  { riskTolerance: riskOutput.riskTolerance, amount: fieldsOutput.amount, timeline: fieldsOutput.timeline },
  sendToUser, waitForResponse
);
const profile = await extractUserProfile(fieldsOutput, riskOutput, prefsOutput);
```

Remove:
- All `PhaseSourceParams` intermediate variables.
- `buildSourceParams` import (check if still used anywhere; if not, delete `src/lib/build-source-params.ts`).
- `contradictory` handler import.

**Files:**
- `src/server/pipeline/stages/clarify/clarify.stage.ts`
- `src/lib/build-source-params.ts` — delete if no other importers remain (grep first)

**Verify:** `npm run test:evals -- clarify.stage.eval.ts`.

---

### Phase 9 — Eval alignment pass

**What:** Final sweep of all clarify eval files to ensure they use new typed I/O, remove obsolete assertions, and add missing cases per spec.

Checklist:
- `clarify.fields.eval.ts` — add `monthlyContribution: 0` case (vague then ₪0, explicit ₪0 on first ask)
- `clarify.preferences.eval.ts` — add `monthlyContribution: 0` case (lump-sum framing), verify riskTolerance framing cases
- `clarify.extraction.eval.ts` — remove all secondary-signal riskTolerance cases (they belong in the risk eval now), remove brokerage assertions
- `clarify.stage.eval.ts` — remove brokerage assertions, verify end-to-end with new phase sequence

**Files:**
- All four eval files above

**Verify:** `npm run test:evals` — full suite passes.

---

### Phase 10 — Rules files for remaining phases (classify, intake)

**What:** Move inline prompts from `clarify.classify.ts`, `clarify.out-of-scope.ts`, and `clarify.unrealistic.ts` into co-located `.rules.md` files (if not already done in phase 7). No behavior changes — purely structural.

**Files:**
- `src/server/pipeline/stages/clarify/intake/clarify.classify.rules.md` — new
- `src/server/pipeline/stages/clarify/intake/clarify.out-of-scope.rules.md` — new (if not extracted in phase 7)
- `src/server/pipeline/stages/clarify/intake/clarify.unrealistic.rules.md` — new (if not extracted in phase 7)
- Corresponding `.ts` files updated to import from rules files

**Verify:** `npm run type-check` passes. All previously-passing tests still pass.

---

## Critical Files Reference

| File | Role |
|------|------|
| `clarify/clarify.stage.ts` | Orchestrator — phases 7–8 |
| `clarify/clarify.constants.ts` | Constants — phase 1 |
| `clarify/clarify.schemas.ts` | New I/O types — phase 2 |
| `clarify/clarify.lib.ts` | Loop utilities — no changes planned |
| `clarify/fields/clarify.fields.ts` | Fields phase — phase 3 |
| `clarify/risk/clarify.risk.ts` | Risk phase — phase 4 (new) |
| `clarify/preferences/clarify.preferences.ts` | Preferences phase — phase 5 |
| `clarify/extraction/clarify.extraction.ts` | Thin extraction — phase 6 |
| `clarify/intake/clarify.classify.ts` | Classifier — phase 7 |
| `clarify/intake/clarify.contradictory.ts` | Delete in phase 7 |
| `src/server/schemas/pipeline.schema.ts` | `UserProfileSchema`, `GoalClassification` — phases 6, 7 |
| `src/lib/build-source-params.ts` | Delete in phase 8 if unused |
