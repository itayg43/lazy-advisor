# Clarify-Only Cleanup + Fields Eval Realignment

## Context

The project is being scoped down to the clarify stage only while the clarify refactor (Phases 5a–10 in `CLARIFY_REFACTOR_PLAN.md`) is in flight. The goal is learning-focused: go deep on one stage, re-introduce research/plan later as separate efforts.

Three things need to happen before Phase 5a resumes:

1. **Delete non-clarify code and DB persistence** so the repository reflects the new scope. Exploration confirmed clarify has zero imports from research/plan, so deletion is mechanically safe.
2. **Align documentation** to the clarify-only scope — STATUS, PLAN, WORKFLOW, STORIES, DECISIONS, CLAUDE.md, README, PROJECT_POSITIONING.
3. **Realign fields phase eval Case 1** to the hinted-input / progressive-disclosure convention. The audit found this is the *only* existing eval case that front-loads all user data; contribution and risk evals are already aligned, and rules/prompts for all three finished phases are already decoupled from input shape.

The hint/example opener (Deferred Enhancement A) is **out of scope** for this cleanup — promoted only after 5a/5b land.

Persistence decision: delete plan/step DB entirely. Clarify runs in-memory and returns `UserProfile` at session end. Prisma infra stays but becomes idle until research stage is rebuilt.

---

## Phase A — Deletion

### A1. Non-clarify stage code

Delete entire directories:
- `src/server/pipeline/stages/research/` (all 8 files, including `.runs.jsonl` and `LAST_RUN.md`)
- `src/server/repositories/plan/` (repository, tests, index)
- `src/server/services/plan/` (service, tests, index)

Delete research-only libs:
- `src/server/pipeline/lib/build-allocation-summary.ts`
- `src/server/pipeline/lib/build-source-params.ts` (already noted in refactor plan Phase 8 as delete-if-unused — confirm no clarify consumers before removing)
- `src/server/pipeline/tools/web-search.tool.ts` (research-only tool)

### A2. Prisma schema

- Edit `prisma/schema.prisma`: remove `Plan` and `Step` models (and any relations).
- Reset DB: `npm run test:repositories` triggers Prisma's safety prompt; before that, verify no clarify code uses `Plan`/`Step`. Drop the models, generate migration, regenerate client.
- `src/server/types/domain.types.ts`: remove Prisma `Plan`/`Step` re-exports. Keep the file if other types remain.

### A3. Cross-boundary surgical edits

- `src/server/pipeline/tools/index.ts`: remove `Stage` type and `STAGE_TOOLS` multi-stage routing. Reduce to clarify-only tools export.
- `src/server/schemas/pipeline.schema.ts`: remove `ResearchCategorySchema`, `ResearchSummarySchema`, `AllocationSliceSchema`, `AllocationPlanSchema`, `RecommendedEtfSchema`. **Verify with grep first** that nothing under `clarify/` imports these. Keep `RiskTolerance`, `UserProfileSchema`, and anything clarify references.

### A4. Test files / eval runs

- Delete any non-clarify `*.test.ts` files discovered during A1 (already covered by dir deletion).
- Delete non-clarify eval run logs (`research.*.runs.jsonl`) — covered by dir deletion.

### A5. Blocker verification (run before committing)

- `grep -r "from.*research" src/server/pipeline/stages/clarify/` — must return zero results.
- `grep -r "from.*plan" src/server/repositories/ src/server/services/` (excluding deletions) — zero results.
- `npm run type-check` — passes with the above deletions.

---

## Phase B — Documentation Alignment

### Full deletions
- `documentation/workflow/stages/RESEARCH_EXAMPLES.md`
- `documentation/plan/plan-sections/PLAN_SECTION_4.md` (Research)
- `documentation/plan/plan-sections/PLAN_SECTION_5.md` (Plan)
- `documentation/plan/plan-sections/PLAN_SECTION_6.md` (Iterate)
- `documentation/plan/plan-sections/PLAN_SECTION_7.md` (WebSocket/Session — tied to multi-stage orchestration)

### Surgical edits

- **`documentation/STATUS.md`** — rewrite "Up Next" section to clarify-only (just the CLARIFY_REFACTOR_PLAN pointer + remaining phases). Remove Sections 4–6 rows from the status table. Drop the "Research stage: examples → rules refactor", "Deferred: Crypto ETF support", and "Tasks 4.4c, 4.4d, 4.7" bullets.

- **`documentation/plan/PLAN.md`** — remove Section 4–6 (and Section 7 if multi-stage) rows from the table of contents; rewrite scope summary to reflect clarify-only.

- **`documentation/workflow/WORKFLOW.md`** — rewrite the "Clarify → Research → Plan → Iterate" pipeline diagram to single-stage. Remove stage-2–4 descriptions. Remove plan/step persistence references from the session/state sections.

- **`documentation/workflow/STORIES.md`** — remove intro mentions of Stages 2–4. Stories 2–5 reference downstream stages and should be trimmed to clarify-only variants (or deleted if entirely post-clarify).

- **`documentation/DECISIONS.md`** — audit: keep clarify-scoped decisions, remove any sections referencing research/plan/iterate.

- **`CLAUDE.md`** — in the References table, remove any row pointing at non-clarify stage rules or workflow sections. Review the "How to Work" section for multi-stage assumptions.

- **`README.md`** — rewrite any pipeline/multi-stage mention to clarify-only framing.

- **`PROJECT_POSITIONING.md`** — review the "Where autonomy fits naturally" line (research and plan stages). Keep positioning intact but note those stages are out of scope for now; do not delete the paragraph — it's the rationale for why clarify is deliberately constrained.

- **`CLARIFY_REFACTOR_PLAN.md`** — keep as-is. Still the active refactor plan.

---

## Phase C — Fields Eval Realignment

Only one change required.

### File
`src/server/pipeline/stages/clarify/fields/clarify.fields.eval.ts`

### Change
**Case 1 (lines 35–53)** currently front-loads all fields in the opening user message: `"I'm 24, ₪18,000, 10 years, yes emergency fund, no debt"`. This is synthetic depth for a beginner user and violates the progressive-disclosure convention.

**Rewrite** Case 1 to use a realistic sparse opener (e.g. `"I want to start investing, I have about ₪18,000 and maybe 10 years"`) followed by progressive disclosure of the missing fields (emergency fund, debt, age) across the turns. Assertions stay the same — the final `FieldsPhaseOutput` should be identical; only the conversation shape changes.

### What NOT to change
- `clarify.fields.rules.md` — already documents gaps-only + batching behavior correctly.
- `clarify.fields.ts` prompt — already decoupled from input shape.
- Cases 2–4 in the eval file — already follow the convention.
- `clarify.contribution.eval.ts`, `clarify.risk.eval.ts` — already aligned, no changes.
- `clarify.contribution.rules.md`, `clarify.risk.rules.md` — already aligned, no changes.

---

## Out of Scope (deferred)

- **Hint/example opener (Deferred Enhancement A)** — defer until after 5a/5b.
- **Creating a `documentation/workflow/stages/CLARIFY_RULES.md`** — can be done during Phase 10 of the refactor (rules file extraction pass), not now.
- **Removing Prisma entirely** — keep the client and migration infra; we'll reintroduce schema when research returns.

---

## Sequencing

Suggested order, one PR per phase:

1. **PR 1 — Phase A deletions** (code + Prisma schema). Smallest reviewable diff. `npm run type-check`, `npm test`, `npm run test:repositories` must all pass before merge.
2. **PR 2 — Phase B doc alignment**. Pure docs, no code changes.
3. **PR 3 — Phase C fields Case 1 rewrite**. Single eval file; `npm run test:evals -- clarify.fields.eval.ts` must pass.

Rationale for splitting: code/docs/evals each have different review focuses; one PR per phase keeps reviewers efficient and keeps rollback surgical if something breaks.

---

## Critical files touched

| File | Phase | Action |
|------|-------|--------|
| `src/server/pipeline/stages/research/` | A1 | Delete dir |
| `src/server/repositories/plan/` | A1 | Delete dir |
| `src/server/services/plan/` | A1 | Delete dir |
| `src/server/pipeline/lib/build-allocation-summary.ts` | A1 | Delete |
| `src/server/pipeline/lib/build-source-params.ts` | A1 | Delete if unused |
| `src/server/pipeline/tools/web-search.tool.ts` | A1 | Delete |
| `prisma/schema.prisma` | A2 | Remove Plan + Step models |
| `src/server/types/domain.types.ts` | A2 | Remove Plan/Step re-exports |
| `src/server/pipeline/tools/index.ts` | A3 | Remove multi-stage routing |
| `src/server/schemas/pipeline.schema.ts` | A3 | Remove research/plan schemas |
| `documentation/STATUS.md` | B | Rewrite Up Next + status table |
| `documentation/plan/PLAN.md` | B | Remove Section 4–7 rows |
| `documentation/workflow/WORKFLOW.md` | B | Single-stage rewrite |
| `documentation/workflow/STORIES.md` | B | Trim to clarify-only |
| `documentation/workflow/stages/RESEARCH_EXAMPLES.md` | B | Delete |
| `documentation/plan/plan-sections/PLAN_SECTION_4.md` → `7.md` | B | Delete |
| `documentation/DECISIONS.md` | B | Audit + trim |
| `CLAUDE.md` | B | References table cleanup |
| `README.md` | B | Rewrite pipeline framing |
| `PROJECT_POSITIONING.md` | B | Minor edit re: research/plan scope |
| `src/server/pipeline/stages/clarify/fields/clarify.fields.eval.ts` | C | Rewrite Case 1 |

---

## Verification

Run at the end of each PR, in order:

1. **Phase A PR:**
   - `npm run type-check` — zero errors.
   - `npm run lint` — zero warnings on touched files.
   - `npm test` — all unit tests pass (none should reference deleted paths).
   - `npm run test:repositories` — passes with the trimmed Prisma schema (accept the `db push --force-reset` prompt with "yes").
   - Smoke: `grep -r "research\|plan.service\|plan.repository" src/` returns no matches (excluding unrelated use of the word "plan" in comments).

2. **Phase B PR:**
   - Manual review: no stale references to research/plan/iterate in any `.md` file. `grep -ri "research stage\|plan stage\|iterate stage" documentation/ CLAUDE.md README.md PROJECT_POSITIONING.md` returns clean.
   - `CLARIFY_REFACTOR_PLAN.md` still renders coherently on its own.

3. **Phase C PR:**
   - `npm run test:evals -- clarify.fields.eval.ts` passes, including the rewritten Case 1.
   - Read the Case 1 run log (`clarify.fields.runs.jsonl`) — the new conversation should look like a beginner with a sparse opener, not a data dump.

End-state check: the refactor plan (`CLARIFY_REFACTOR_PLAN.md`) Phase 5a can resume cleanly — no dead imports, no stale doc pointers, and evals for completed phases reflect realistic user behavior.
