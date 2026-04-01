# Lazy Advisor — Architecture & Workflow

An agentic investment planning CLI for beginner ETF investors. Inspired by the Israeli "Lazy Investor" philosophy — invest in ETFs, set up monthly contributions, stick to the plan, don't overthink it. The agent asks smart questions, researches current ETF data, and produces an actionable plan with phased steps. Within a session, the user can iterate on the plan. Across sessions (stretch goal), the plan evolves as the user's situation changes.

## Disclaimer

This is an **educational/demonstrative portfolio project**, not a licensed financial advisor. The CLI displays a clear disclaimer on every startup:

> This tool is for educational purposes only. It is designed for beginner investors learning about ETF investing. It does not constitute financial advice. Always do your own research and consult a licensed financial advisor before making investment decisions.

Target audience: beginner investors overwhelmed by getting started — not experienced traders looking for alpha.

## Architecture: Client + Backend Service

```
Client (CLI or React)
  │
  └── WS /api/v1/sessions/:id/ws        → Backend Service (bidirectional)

Backend Service (single Express app)
  │
  ├── WebSocket handler                  → session lifecycle, event streaming
  ├── Pipeline engine                    → stages, tool-calling, feedback classification
  ├── Plan domain                        → CRUD, Prisma → PostgreSQL
  ├── Gateway                            → auth, rate limiting
  ├── OpenAI API                         → LLM calls with tools
  └── Redis                              → rate limiting
```

### Client
CLI or React frontend. Connects to the backend via WebSocket for the entire session. Sends user messages, receives agent events.

### Backend Service
A single Express app that handles everything: client connections, pipeline execution, plan persistence, and external API calls. The pipeline runs in-process — no inter-service communication needed.

**Gateway layer**: Auth, rate limiting, session lifecycle, WebSocket connection management.

**Pipeline engine**: Runs the staged pipeline (Clarify → Research → Plan → Iterate) in-process. Each stage calls OpenAI directly (including built-in web search). Tool calls like `create_step` and `ask_user` are direct function calls — no HTTP or message passing between services.

**Plan domain**: Owns plan/step CRUD and persistence via Prisma/PostgreSQL. Each tool call persists immediately — steps exist in the DB as soon as the LLM creates them.

### Communication flow

**Starting a session:**
1. Client opens WebSocket to the backend
2. Client sends goal message
3. Backend creates session, starts pipeline execution in-process

**Live streaming (search progress, steps appearing):**
1. Pipeline completes a search or creates a step
2. Backend sends event directly to the client over WebSocket: `{ type: "search_progress", query: "..." }`

**ask_user (bidirectional — agent asks, user responds):**
1. Pipeline needs user input, sends `clarification` event to client over WebSocket
2. Client responds over WebSocket
3. Pipeline receives the response via an in-process callback (e.g., a Promise that resolves when the WebSocket message arrives) and continues

**Plan persistence (tool calls during the loop):**
1. Pipeline tool call invokes plan domain directly (function call)
2. Step is persisted to DB, result returned synchronously
3. Event sent to client over WebSocket so the step appears live

### WebSocket events (Backend ↔ Client)
- **Server → Client**: `clarification`, `search_progress`, `step_created`, `step_updated`, `step_removed`, `plan_complete`, `message`, `error`
- **Client → Server**: user's goal, answers to clarification questions, iteration feedback

### Session lifecycle
- Session state (user profile, pipeline stage, current plan) lives in-memory, tied to the WebSocket connection
- **Inactivity timeout**: 15-minute TTL. If the pipeline is waiting on `ask_user` and the user doesn't respond, the session is terminated. Steps already persisted survive.
- **WebSocket disconnect**: Session is lost — start a new one. Incremental persistence means completed steps survive even if the session drops mid-loop. The worst case is losing the current LLM invocation's remaining tool calls.
- **Production upgrade path**: For horizontal scaling or reconnection support, session state moves to Redis. This is a storage-layer change, not an architectural one — the pipeline logic doesn't change.

### Why this architecture
- **Single service, minimal coordination**: The pipeline runs in-process. Tool calls are function calls, not HTTP requests. `ask_user` resolves via an in-process Promise, not Pub/Sub. No race conditions, no distributed debugging.
- **Separation of concerns via modules, not services**: Gateway, pipeline engine, and plan domain are distinct layers within the same process. Clean boundaries without the overhead of inter-service communication.
- **Right-sized for the workload**: A single session is one user, one pipeline, one WebSocket connection. There's no concurrent processing that would benefit from service separation. The interesting engineering is in the pipeline — stages, feedback classification, tool-calling loop — not in distributed coordination.

## MVP scope

**In:**
- CLI that connects to the backend via WebSocket
- Single session: goal → adaptive clarification → web search → plan with phases
- Within-session iteration ("anything to adjust?" → user tweaks → updated plan)
- WebSocket streaming (user sees research progress and steps appearing live)
- In-memory session state with 15-minute inactivity timeout
- Specialized financial system prompt
- Tool-calling loop with `search`, `create_step`, `ask_user`, `finish_plan`
- Plan persistence to DB (Prisma + PostgreSQL) — saved on every `plan_complete`, not on user confirmation
- Redis for rate limiting

**Out (stretch goals):**
- Multi-session continuity (load previous plan/profile)
- Persistent user memory across sessions
- Adaptive verbosity (adjust explanation depth over time)
- Step status tracking (done/skipped)
- `get_plan`, `update_step`, `update_profile` tools
- Redis session state (for horizontal scaling and reconnection support)
- WebSocket reconnection with event replay (server buffers events per session, client sends last received event ID on reconnect)

## Two levels of conversation

**Within a session (MVP)** — the CLI stays open. The agent clarifies, plans, and asks if the user wants to adjust. Back-and-forth continues until the user is satisfied. See [WORKFLOW_EXAMPLES.md](WORKFLOW_EXAMPLES.md) for full dialogue examples.

**Across sessions (stretch)** — user comes back days/weeks later with new context (executed steps, market events, new money). Agent loads profile + plan from DB and picks up where it left off.

## Staged pipeline architecture

The agent is NOT one long LLM conversation. It's a pipeline of discrete stages, each with its own focused prompt and minimal context. This prevents context bloat, keeps behavior consistent, and makes each stage independently testable.

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. CLARIFY  │ ──► │ 2. RESEARCH  │ ──► │  3. PLAN      │ ──► │ 4. ITERATE    │
│              │     │              │     │               │     │   (loop)      │
│ Analyze input│     │ Run searches │     │ Build plan    │     │ Classify      │
│ Ask questions│     │ Summarize    │     │ with phases   │     │ feedback      │
│ Build profile│     │ findings     │     │ and reasoning │     │               │
└─────────────┘     └──────▲───────┘     └───────┬───────┘     └───┬──┬──┬────┘
                           │                     │ SAVE              │  │  │
                           │                     ▼                   │  │  │
                           └──── research_and_adjust ────────────────┘  │  │
                                        adjust (self-loop + SAVE) ◄────┘  │
                                                              done ───────┴──► END
```

Each stage's contract (input/output, tools, behavior rules) is documented in its plan section file. See [plan sections](../plan/plan-sections/).

### Stage boundary validation

Each handoff between stages is validated with a Zod schema: user profile (Stage 1 → 2), research summary (Stage 2 → 3), plan structure (Stage 3 → 4). If the LLM produces output that fails validation, the pipeline stops immediately and sends an `error` event — no retry. A malformed handoff means the LLM fundamentally misunderstood the task, and retrying the same prompt is unlikely to help. The user starts a new session.

### OpenAI failure handling

All OpenAI API calls (every stage) use retry with exponential backoff (3 attempts). If all retries fail, behavior depends on whether a plan already exists in the DB:

- **No plan yet** (Stage 1 or 2 failure): Nothing is saved. Send `error` event via WebSocket, user retries from scratch.
- **Mid-plan** (Stage 3 failure): Any steps already created are persisted, but the plan is incomplete. Send `error` event. User can start a new session.
- **Plan already complete** (Stage 4 failure): The user's previous completed plan is safe in the DB. Send `error` event via WebSocket: "Couldn't process your last change, but your previous plan is saved."

Incremental persistence means the worst case is losing the current LLM invocation's remaining tool calls — never steps that were already created.

### Why this matters

1. **No context degradation** — each stage starts fresh with a focused prompt and minimal input
2. **Search results don't pollute** — raw search text is summarized in stage 2 and discarded
3. **Validated handoffs** — Zod schemas at every stage boundary catch malformed LLM output before it propagates downstream
4. **Testable** — each stage can be tested independently
5. **Predictable** — the agent behaves consistently because no single prompt is trying to do everything

## Output model: plans and steps

```json
{
  "plan": {
    "goal": "Build diversified ETF portfolio with $10k",
    "phases": [
      {
        "phase": 1,
        "steps": [
          { "action": "Open Fidelity brokerage account", "reasoning": "No fees, commission-free ETFs" }
        ]
      },
      {
        "phase": 2,
        "steps": [
          { "action": "Buy $5.5k VTI", "reasoning": "0.03% ER, broad US market, growth engine" },
          { "action": "Buy $4.5k VWO", "reasoning": "0.08% ER, emerging markets diversification" }
        ]
      }
    ],
    "summary": "Aggressive two-fund portfolio: 60% US, 40% emerging markets"
  }
}
```

## Observability

Structured logging from the start, Prometheus metrics added incrementally — same patterns as ai-task-assistant, adapted for an agentic workflow.

### Metrics (Prometheus)

MVP metrics — only what comes trivially from existing middleware wrappers. Custom pipeline-specific metrics deferred until the system matures.

**Request/response (from middleware):**
- `http_request_duration_seconds` (histogram, labels: `method`, `route`, `status`) — request latency.
- `http_requests_total` (counter, labels: `method`, `route`, `status`) — request counts and error rates.

**OpenAI:**
- `openai_request_duration_seconds` (histogram, labels: `stage`) — LLM latency per stage.
- `openai_tokens_total` (counter, labels: `type`: `prompt`, `completion`, `stage`) — token usage per stage.

**Deferred (add incrementally):**
- Pipeline stage durations, session durations, completion outcomes
- Search reliability and latency
- Feedback classification distribution
- Step operation patterns

### Structured logging

JSON logs with consistent fields: `sessionId`, `stage`, `timestamp`, `event`. Key log points:
- Stage transitions (clarify → research → plan → iterate)
- Tool call execution (which tool, duration, success/failure)
- Feedback classification decisions (what type, why)
- Search queries and result quality
- Errors with full context (which stage, what failed, what was the pipeline state)
