## Section 8: CLI Client

**Goal**: `npx lazy-advisor "I want to invest $10k"` works end-to-end.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 8.1 | CLI config: server URL, auth token from env/config file | `src/cli/config.ts` | Section 7 |
| 8.2 | WebSocket client connection (connect, parse events, handle errors) | `src/cli/connection.ts` | 8.1 |
| 8.3 | Event renderer: format each event type for terminal (chalk for colors) | `src/cli/renderer.ts` | 1.7 |
| 8.4 | User input handling: readline, prompt on `clarification`, Ctrl+C graceful shutdown | `src/cli/input.ts` | 8.2 |
| 8.5 | CLI app: wire connection + renderer + input together | `src/cli/app.ts` | 8.2-8.4 |
| 8.6 | CLI entry point: parse args, print disclaimer, start app, graceful shutdown | `src/cli/cli.ts`, `package.json` (bin) | 8.5 |

**Runnable after**: Full happy path works from CLI
