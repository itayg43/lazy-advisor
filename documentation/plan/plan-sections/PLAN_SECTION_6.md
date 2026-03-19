## Section 6: Stage 4 — Iterate

**Goal**: Classifies user feedback, routes to adjust/research_and_adjust/clarify/done. Full pipeline logic complete.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 6.1 | `update_step` + `remove_step` tools: call stepService | `src/server/pipeline/tools/update-step.tool.ts`, `remove-step.tool.ts` | 2.6 |
| 6.2 | Register all iterate tools in registry | `src/server/pipeline/tool-registry.ts` | 6.1 |
| 6.3 | Feedback classifier: cheap model (`gpt-4o-mini`), returns validated `FeedbackClassification` | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 3.1, 3.2 |
| 6.4 | Iterate — `adjust` flow: modify plan in place with update/remove/create tools | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 6.1, 6.2, 6.3 |
| 6.5 | Iterate — `research_and_adjust` flow: update profile, re-run Research → Plan stages | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 6.3, Sections 4+5 |
| 6.6 | Iterate — `clarify` + `done` flows | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 6.3 |
| 6.7 | Iteration counter + limit enforcement (max 5, clarify doesn't count) | `src/server/pipeline/stages/iterate/iterate.stage.ts` | 6.4-6.6 |
| 6.8 | Iterate stage tests (classification routing, each flow, iteration limit, mixed iterations) | `src/server/pipeline/stages/iterate/iterate.stage.test.ts` | 3.3, 4.2 |

**Runnable after**: Full iterate loop works in isolation — classify, route, modify, persist
