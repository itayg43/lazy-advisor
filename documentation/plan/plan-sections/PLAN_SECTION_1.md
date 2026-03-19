## Section 1: Project Setup

**Goal**: Working TypeScript project with type-checking, testing, Docker services, and folder skeleton. After this: `npm run type-check`, `npm run test` all pass.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 1.1 | Init repo, package.json, tsconfig (`strict`, `ES2022`, `NodeNext`), `type-check` script (`tsc --noEmit`) | `package.json`, `tsconfig.json` | — |
| 1.2 | Vitest setup | `vitest.config.ts` | 1.1 |
| 1.3 | Folder skeleton + placeholder entry points, `dev:server` script with `tsx` | All dirs, `src/server/server.ts`, `src/server/app.ts`, `src/cli/cli.ts`, `src/cli/app.ts` | 1.1 |
| 1.4 | Docker Compose (Postgres 16 + Redis 7), `.env.example`, `.gitignore` | `docker-compose.yml`, `.env.example`, `.gitignore` | 1.1 |
| 1.5 | Config module with dotenv + envalid for env var validation | `src/server/config.ts` | 1.3 |
| 1.6 | Shared constants (caps, timeouts) + event types (discriminated unions) | `src/shared/constants/constants.ts`, `src/shared/types/events.types.ts` | 1.3 |
| 1.7 | Generic `withRetry` utility + unit tests | `src/server/lib/with-retry/with-retry.ts`, `src/server/lib/with-retry/with-retry.test.ts`, `src/server/lib/with-retry/index.ts` | 1.2 |

**Runnable after**: `npm run type-check`, `npm run test`, `docker compose up -d`
