## Section 6: Stage 4 — Iterate

**Goal**: Classifies user feedback, routes to adjust/research_and_adjust/clarify/done. Full pipeline logic complete.

### Stage Contract

- **System prompt**: Two-step process. First: classify the feedback (cheap/fast model — routing decision, not creative). Second: act on the classification (full model for `adjust`, or re-enter Stage 2 for `research_and_adjust`)
- **Input**: Current plan + user profile + user's feedback message (NOT the full conversation history)
- **Output**: Classification (cheap model) + updated plan or re-entry to Stage 2 (full model)
- **Tools**: `ask_user`, `web_search` (built-in), `create_step`, `update_step(step_id, action?, reasoning?, phase?)`, `remove_step(step_id)`, `finish_plan`

**Feedback classification:**

| Type | Trigger | Pipeline action | Example |
|------|---------|----------------|---------|
| **`adjust`** | Can be resolved with existing research | Stay in Stage 4, modify plan | "skip bonds, put it all in equities" |
| **`research_and_adjust`** | Introduces something the agent hasn't researched | Update profile, loop back to Stage 2 → 3 → 4 | "I want more tech" / "actually I'm in Israel" |
| **`clarify`** | Ambiguous feedback or a question | Ask follow-up, wait, re-classify | "what's the difference between VTI and VOO?" |
| **`done`** | User is satisfied | End session | "looks good" |

- **Behavior**: Each iteration is a fresh LLM call with only the current plan + user profile + latest feedback. No context accumulation. `clarify` doesn't count toward iteration limit. `adjust` modifies plan in place. `research_and_adjust` updates profile before re-entering Stage 2
- **Events**: `step_updated`, `step_removed`, `step_created`, `plan_complete`
- **Persistence**: Steps persisted incrementally — each tool call writes to DB immediately. `finish_plan` marks complete. Session drops mid-loop lose at most the current LLM invocation's remaining tool calls
- **Iteration limit**: Max 5. After that, present current plan as final
- **Exit**: User satisfied, iteration limit reached, or session closes

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 6.1 | `update_step` + `remove_step` tools: call stepService | `src/server/pipeline/tools/update-step.tool.ts`, `remove-step.tool.ts` | 2.6 |
| 6.2 | Register all iterate tools in registry | `src/server/pipeline/tools/index.ts` | 6.1 |
| 6.3 | Feedback classifier: cheap model (`gpt-4o-mini`), returns validated `FeedbackClassification` | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 3.1, 3.2 |
| 6.4 | Iterate — `adjust` flow: modify plan in place with update/remove/create tools | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 6.1, 6.2, 6.3 |
| 6.5 | Iterate — `research_and_adjust` flow: update profile, re-run Research → Plan stages | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 6.3, Sections 4+5 |
| 6.6 | Iterate — `clarify` + `done` flows | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 6.3 |
| 6.7 | Iteration counter + limit enforcement (max 5, clarify doesn't count) | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 6.4-6.6 |
| 6.8 | Iterate stage tests (classification routing, each flow, iteration limit, mixed iterations) | `src/server/pipeline/stages/iterate/iterate.stage.test.ts` | 4.2 |

**Runnable after**: Full iterate loop works in isolation — classify, route, modify, persist
