## Section 10: Observability

**Goal**: Structured JSON logging + Prometheus metrics (`/metrics` endpoint).

| Task | What | Files | Depends on |
|------|------|-------|------------|
| 10.1 | Structured logger (pino): base logger + child loggers with `sessionId`/`stage` | `src/server/observability/logger.ts` | Section 1 |
| 10.2 | Add logging to all pipeline stages + orchestrator | All stage files, orchestrator | 10.1 |
| 10.3 | Prometheus metrics: `http_request_duration_seconds`, `http_requests_total`, `openai_request_duration_seconds`, `openai_tokens_total` + `GET /metrics` | `src/server/observability/metrics.ts` | 7.1 |
| 10.4 | Instrument OpenAI wrapper with metrics (duration, tokens) | `src/server/clients/openai.client.ts` | 10.3, 3.2 |
| 10.5 | HTTP metrics middleware | `src/server/app.ts` | 10.3 |

**Runnable after**: `GET /metrics` returns Prometheus data, logs are structured JSON
