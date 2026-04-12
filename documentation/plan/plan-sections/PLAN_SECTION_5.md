## Section 5: Stage 3 — Plan

**Goal**: Given UserProfile + ResearchSummary, generates phased plan with steps persisted to DB.

### Stage Contract

- **System prompt**: Focused on plan generation — explain concepts inline, be educational and opinionated, create phased steps with reasoning
- **Input**: User profile + research summary (both structured, both small)
- **Output**: Structured plan (phases, steps, reasoning, summary)
- **Tools**: `create_step(action, reasoning, phase)`, `finish_plan(summary)`
- **Behavior**: Verbose and educational — every recommendation includes *why*
- **Events**: `step_created` (steps appearing one by one), `plan_complete`

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 5.1 | `create_step` tool: calls stepService, emits `step_created` | `src/server/pipeline/tools/create-step.tool.ts` | — |
| 5.2 | `finish_plan` tool: calls planService.markComplete, emits `plan_complete` | `src/server/pipeline/tools/finish-plan.tool.ts` | — |
| 5.3 | Register plan tools in registry | `src/server/pipeline/tools/index.ts` | 5.1, 5.2 |
| 5.4 | Plan stage: system prompt, tool-calling loop, educational output, stage cap → force finish | `src/server/pipeline/stages/plan/plan.stage.ts` | 5.1, 5.2 |
| 5.5 | Plan stage tests (happy path, step ordering, stage cap, DB persistence verification) | `src/server/pipeline/stages/plan/plan.stage.test.ts` | 5.4 |

**Runnable after**: Plan stage creates plans/steps in Postgres, events emitted
