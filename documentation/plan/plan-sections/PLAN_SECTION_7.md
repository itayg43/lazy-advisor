## Section 7: WebSocket + Session Lifecycle

**Goal**: Express server + WS endpoint. Connect via `wscat`, run the full pipeline. First time everything works end-to-end.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 7.1 | Express app: CORS, `GET /health`, middleware | `src/server/app.ts`; Server init: HTTP server, listen, shutdown | `src/server/server.ts` | Section 1 |
| 7.2 | WebSocket handler: upgrade on `/api/v1/sessions/ws`, create session, route messages | `src/server/ws/handler/handler.ts` | 7.1 |
| 7.3 | Session class: state, `sendEvent()`, `waitForUserResponse()` (Promise-based), inactivity timer, `destroy()` | `src/server/ws/session.ts` | 1.7 |
| 7.4 | Event serialization: serialize server events, deserialize + Zod-validate client messages | `src/server/ws/events.ts` | 1.7 |
| 7.5 | Pipeline orchestrator: `runPipeline(session, goal)` — wires all stages, enforces Zod at boundaries, handles errors | `src/server/pipeline/orchestrator/orchestrator.ts` | Sections 3-6, 7.3 |
| 7.6 | Wire WS handler → orchestrator (first message = goal, subsequent = user responses) | `src/server/ws/handler/handler.ts` | 7.2, 7.5 |
| 7.7 | Session timeout (15min) + disconnect handling (reject pending promises) | `src/server/ws/session.ts` | 7.3 |
| 7.8 | WebSocket integration tests (full lifecycle, timeout, disconnect, malformed messages) | `src/server/ws/handler/handler.integration.test.ts` | 7.6, 7.7 |

**Runnable after**: `npm run dev:server` + `wscat` → full pipeline streams events back
