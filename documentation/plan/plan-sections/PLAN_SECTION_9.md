## Section 9: Middleware Layer

**Goal**: Auth + rate limiting protect the WebSocket endpoint.

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 9.1 | API key auth (Bearer header or `?token=` query param for WS) | `src/server/middlewares/auth/auth.middleware.ts`, `src/server/config.ts` | 1.6 |
| 9.2 | Redis rate limiter (sliding window, N sessions/IP/hour) | `src/server/middlewares/rate-limiter/rate-limiter.middleware.ts` | 1.5, 1.6 |
| 9.3 | Apply middlewares to WS handler (auth → rate limit → upgrade) | `src/server/ws/handler/handler.ts` | 9.1, 9.2, 7.2 |
| 9.4 | CLI sends auth token (from env var or config file) | `src/cli/config.ts`, `src/cli/connection.ts` | 9.1 |
| 9.5 | Gateway tests (missing/invalid token, rate limit exceeded/reset) | `src/server/middlewares/auth/auth.middleware.test.ts`, `src/server/middlewares/rate-limiter/rate-limiter.middleware.test.ts` | 9.1, 9.2 |

**Runnable after**: Unauthorized/abusive clients rejected
