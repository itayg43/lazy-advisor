## Section 3: Stage 1 — Clarify

**Goal**: Given raw goal text, calls OpenAI with `ask_user` tool, asks adaptive questions, produces validated UserProfile.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 3.1 | Zod schemas for ALL stage boundaries: `UserProfileSchema`, `ResearchSummarySchema`, `PlanOutputSchema`, `FeedbackClassificationSchema` | `src/server/schemas/pipeline.schema.ts` | Section 1 |
| 3.2 | OpenAI client wrapper: `callOpenAI()` with retry, logging, token counting. Supports `cheapModel` for classification. | `src/server/clients/openai.client.ts` | 1.8, 1.6 |
| 3.3 | Mock OpenAI test helper | `src/server/mocks/openai.mock.ts` | 3.2 |
| 3.4 | `ask_user` tool: definition + handler. Decoupled from WebSocket via callbacks (`sendToUser`, `waitForResponse`) | `src/server/pipeline/tools/ask-user.tool.ts` | 3.1 |
| 3.5 | Tool registry: maps stage names to allowed tools | `src/server/pipeline/tool-registry.ts` | 3.4 |
| 3.6 | Clarify stage: system prompt, tool-calling loop, profile extraction, Zod validation, stage cap | `src/server/pipeline/stages/clarify/clarify.stage.ts` | 3.1, 3.2, 3.4, 3.5 |
| 3.7 | Clarify stage tests (detailed/minimal/contradictory input, validation failure, cap) | `src/server/pipeline/stages/clarify/clarify.stage.test.ts` | 3.3, 3.6 |

**Runnable after**: Clarify stage works in isolation with mock callbacks, produces validated UserProfile
