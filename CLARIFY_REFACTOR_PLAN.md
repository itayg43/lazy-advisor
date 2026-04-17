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
| 3 | Refactor fields phase to typed I/O | Complete |
| 3b | Create the contribution phase | Complete |
| 4 | Create the risk phase | Complete |
| 5 | Refactor preferences phase to typed I/O | Not started |
| 6 | Refactor extraction to thin assembly | Not started |
| 7 | Intake cleanup: drop contradictory, update out-of-scope and unrealistic | Not started |
| 8 | Wire new pipeline in `clarify.stage.ts` | Not started |
| 9 | Eval alignment pass | Not started |
| 10 | Rules files for remaining phases | Not started |

---

## Phases


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
- Handle `plansToContribute: false`: show lump-sum framing; `true`: include periodic contribution context and compound growth benefit.

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

**Intake→fields context gap (decided during Phase 3):** When a user goes through an intake redirect (out-of-scope, unrealistic) and provides financial details during that conversation, `collectFields` starts fresh from the original goal and will re-ask for those fields. This is intentional — intake's sole job is to confirm the user is willing to proceed with ETF investing, not to gather investment data. The UX regression (re-asking already-stated fields) is acceptable for now.

Fallback if quality proves poor: add a lightweight LLM extraction call at the end of each intake handler to produce a clean goal string (e.g. `"I want to invest ₪30,000 for 10 years via ETFs"`) that is returned as `redirectedGoal` and passed to `collectFields` instead of the original goal.

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
- `src/server/pipeline/stages/clarify/clarify.stage.test.ts` — rewrite: drop per-phase mocks (`collectFields`, `collectPreferences`, etc.) and mock `callOpenAI`/`callOpenAIParsed` at the boundary instead. This tests the orchestrator's actual coordination logic end-to-end without bypassing phase implementations.
- `src/lib/build-source-params.ts` — delete if no other importers remain (grep first)

**Verify:** `npm run type-check` (removes all `@ts-expect-error` markers added during phases 3–7), `npm test`, `npm run test:evals -- clarify.stage.eval.ts`.

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
| `clarify/contribution/clarify.contribution.ts` | Contribution phase — phase 3b (new) |
| `clarify/risk/clarify.risk.ts` | Risk phase — phase 4 (new) |
| `clarify/preferences/clarify.preferences.ts` | Preferences phase — phase 5 |
| `clarify/extraction/clarify.extraction.ts` | Thin extraction — phase 6 |
| `clarify/intake/clarify.classify.ts` | Classifier — phase 7 |
| `clarify/intake/clarify.contradictory.ts` | Delete in phase 7 |
| `src/server/schemas/pipeline.schema.ts` | `UserProfileSchema`, `GoalClassification` — phases 6, 7 |
| `src/lib/build-source-params.ts` | Delete in phase 8 if unused |
