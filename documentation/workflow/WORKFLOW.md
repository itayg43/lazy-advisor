# Lazy Advisor — Architecture & Workflow

An agentic investment planning CLI for beginner ETF investors. Inspired by the Israeli "Lazy Investor" philosophy — invest in ETFs, set up monthly contributions, stick to the plan, don't overthink it. The agent asks smart questions, researches current ETF data, and produces an actionable plan with phased steps. Within a session, the user can iterate on the plan. Across sessions (stretch goal), the plan evolves as the user's situation changes.

> Educational/demonstrative project — not a licensed financial advisor. Target audience: beginner investors getting started, not experienced traders.

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

### Backend Service

**Gateway layer**: Auth, rate limiting, session lifecycle, WebSocket connection management.

**Pipeline engine**: Runs the staged pipeline (Clarify → Research → Plan → Iterate) in-process. Each stage calls OpenAI directly (including built-in web search). Tool calls like `create_step` and `ask_user` are direct function calls — no HTTP or message passing between services.

**Plan domain**: Owns plan/step CRUD and persistence via Prisma/PostgreSQL. Each tool call persists immediately — steps exist in the DB as soon as the LLM creates them.

### Communication flow

The client and backend communicate entirely over WebSocket:
- **Session start**: client sends goal → backend creates session and starts pipeline in-process
- **Streaming**: each search query or step creation triggers a WebSocket event to the client
- **`ask_user`**: pipeline pauses and sends a `clarification` event; client responds over WebSocket; an in-process Promise resolves and the pipeline continues
- **Plan persistence**: tool calls invoke the plan domain directly (function calls, not HTTP); steps persist immediately and trigger a `step_created` event to the client

### WebSocket events (Backend ↔ Client)
- **Server → Client**: `clarification`, `search_progress`, `step_created`, `step_updated`, `step_removed`, `plan_complete`, `message`, `error`
- **Client → Server**: user's goal, answers to clarification questions, iteration feedback

### Session lifecycle
- Session state (user profile, pipeline stage, current plan) lives in-memory, tied to the WebSocket connection
- **Inactivity timeout**: 15-minute TTL. If the pipeline is waiting on `ask_user` and the user doesn't respond, the session is terminated. Steps already persisted survive.
- **WebSocket disconnect**: Session is lost — start a new one. Incremental persistence means completed steps survive even if the session drops mid-loop. The worst case is losing the current LLM invocation's remaining tool calls.
- **Production upgrade path**: For horizontal scaling or reconnection support, session state moves to Redis. This is a storage-layer change, not an architectural one — the pipeline logic doesn't change.

## MVP scope

**In:**
- CLI that connects to the backend via WebSocket
- Single session: goal → adaptive clarification → web search → plan with phases
- Within-session iteration ("anything to adjust?" → user tweaks → updated plan)
- WebSocket streaming (user sees research progress and steps appearing live)
- In-memory session state with 15-minute inactivity timeout
- Specialized financial system prompt
- Tool-calling loop with built-in OpenAI web search (Stage 2) and custom tools: `ask_user` (Stage 1), `create_step`, `finish_plan`, `update_step`, `remove_step` (Stages 3–4)
- Plan persistence to DB (Prisma + PostgreSQL) — saved on every `plan_complete`, not on user confirmation
- Redis for rate limiting

**Out (stretch goals):** multi-session continuity, persistent user memory, adaptive verbosity, step status tracking, Redis session state, WebSocket reconnection with event replay.

## Two levels of conversation

**Within a session (MVP)** — the CLI stays open. The agent clarifies, plans, and asks if the user wants to adjust. Back-and-forth continues until the user is satisfied. See [STORIES.md](STORIES.md) for full dialogue examples.

**Across sessions (stretch)** — user comes back days/weeks later with new context (executed steps, market events, new money). Agent loads profile + plan from DB and picks up where it left off.

## Staged pipeline architecture

Each stage has its own focused prompt and minimal context. Stages start fresh (no accumulated context), search results are summarized and discarded after Stage 2, and Zod schemas validate every handoff.

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

Per-stage behavior examples and conversation scenarios are documented in stage-specific files in the [`stages/`](stages/) directory.

### Clarify stage: intake routing

Before field collection begins, the clarify stage classifies the goal into one of four types: `normal`, `out_of_scope`, `unrealistic`, `contradictory`. Non-normal goals route to a dedicated intake phase first — the agent explains the issue (e.g., stock picking → concentration risk and ETF redirect; unrealistic returns → reality check; contradictory goals → resolution), asks for acceptance. If accepted, the intake phase returns silently (internal signal only) and chains into field collection; if rejected, the session ends with a classification-specific closing message. Normal goals proceed directly to field collection.

After field collection, the stage runs: **risk tolerance** (scenario-based A/B question) → **contribution collection** (whether the user plans to add money over time) → **preference collection** → **profile extraction**. Full phase sequence: intake routing → fields → risk → contribution → preferences → extraction.

Intake routing is code-driven, not prompt-embedded: a single structured LLM call (`classifyGoal`) returns the classification, and the stage function dispatches to the appropriate handler accordingly.

### Debugging failing evals

When an eval fails, check the `*.last-run.md` file alongside the eval before doing anything else. It contains the full transcript of what the model said and did — this is usually enough to diagnose the failure without rerunning.

Common failure patterns and how the transcript reveals them:

- **Overflow throw** (`no response scripted for turn N`): the transcript shows all turns up to the throw. Count the agent questions — the test has fewer scripted responses than the model asked for. Add the missing response.
- **Assertion failure**: the extracted profile is shown at the bottom. Check whether the assertion is too strict (e.g., the model chose `conservative` where `moderate` was expected and both are valid), or whether the model genuinely extracted the wrong value. Loosen the assertion or fix the prompt accordingly.
- **Stage error before transcript**: the last-run entry will be missing or empty. Look at the test's scripted responses — one may be an unexpected or nonsensical answer that caused the stage to error out.

After diagnosing, make the minimal fix (add a response, adjust an assertion, fix the prompt) and rerun the specific eval file to confirm.

### Feedback classification (Stage 4)

Four types: `adjust`, `research_and_adjust`, `clarify`, `done`. See [PLAN_SECTION_6.md](../plan/plan-sections/PLAN_SECTION_6.md) for triggers, routing behavior, and examples.

### Stage boundary validation

Each handoff between stages is validated with a Zod schema: user profile (Stage 1 → 2), research summary (Stage 2 → 3), plan structure (Stage 3 → 4). If the LLM produces output that fails validation, the pipeline stops immediately and sends an `error` event — no retry. A malformed handoff means the LLM fundamentally misunderstood the task, and retrying the same prompt is unlikely to help. The user starts a new session.

### OpenAI failure handling

All OpenAI API calls (every stage) use retry with exponential backoff (3 attempts). If all retries fail, behavior depends on whether a plan already exists in the DB:

- **No plan yet** (Stage 1 or 2 failure): Nothing is saved. Send `error` event via WebSocket, user retries from scratch.
- **Mid-plan** (Stage 3 failure): Any steps already created are persisted, but the plan is incomplete. Send `error` event. User can start a new session.
- **Plan already complete** (Stage 4 failure): The user's previous completed plan is safe in the DB. Send `error` event via WebSocket: "Couldn't process your last change, but your previous plan is saved."

Incremental persistence means the worst case is losing the current LLM invocation's remaining tool calls — never steps that were already created.
