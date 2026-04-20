# Lazy Advisor — Architecture & Workflow

An agentic investment planning CLI for beginner ETF investors. Inspired by the Israeli "Lazy Investor" philosophy — invest in ETFs, set up monthly contributions, stick to the plan, don't overthink it. The agent asks smart questions to clarify the user's investment situation and builds a structured profile — the foundation for research and planning stages to follow. Across sessions (stretch goal), the profile evolves as the user's situation changes.

> Educational/demonstrative project — not a licensed financial advisor. Target audience: beginner investors getting started, not experienced traders.

## Architecture: Client + Backend Service

```
Client (CLI or React)
  │
  └── WS /api/v1/sessions/:id/ws        → Backend Service (bidirectional)

Backend Service (single Express app)
  │
  ├── WebSocket handler                  → session lifecycle, event streaming
  ├── Pipeline engine                    → clarify stage, tool-calling
  ├── Gateway                            → auth, rate limiting
  └── OpenAI API                         → LLM calls with tools
```

### Backend Service

**Gateway layer**: Auth, rate limiting, session lifecycle, WebSocket connection management.

**Pipeline engine**: Runs the clarify stage in-process. Calls OpenAI directly. The `ask_user` tool is a direct function call — no HTTP or message passing between services.

### Communication flow

The client and backend communicate entirely over WebSocket:
- **Session start**: client sends goal → backend creates session and starts pipeline in-process
- **`ask_user`**: pipeline pauses and sends a `clarification` event; client responds over WebSocket; an in-process Promise resolves and the pipeline continues

### WebSocket events (Backend ↔ Client)
- **Server → Client**: `clarification`, `message`, `error`
- **Client → Server**: user's goal, answers to clarification questions

### Session lifecycle
- Session state (user profile, pipeline stage, current plan) lives in-memory, tied to the WebSocket connection
- **Inactivity timeout**: 15-minute TTL. If the pipeline is waiting on `ask_user` and the user doesn't respond, the session is terminated. Steps already persisted survive.
- **WebSocket disconnect**: Session is lost — start a new one. The user profile built so far is not persisted.
- **Production upgrade path**: For horizontal scaling or reconnection support, session state moves to Redis. This is a storage-layer change, not an architectural one — the pipeline logic doesn't change.

## MVP scope

**In:**
- CLI that connects to the backend via WebSocket
- Single session: goal → adaptive clarification → structured user profile
- WebSocket streaming (user sees clarification questions live)
- In-memory session state with 15-minute inactivity timeout
- Specialized financial system prompt
- Tool-calling loop with custom `ask_user` tool

**Out (stretch goals):** multi-session continuity, persistent user memory, adaptive verbosity, Redis session state, WebSocket reconnection with event replay.

## Two levels of conversation

**Within a session (MVP)** — the CLI stays open. The agent clarifies the user's situation through a multi-turn conversation and builds a structured investment profile. Session ends when the profile is complete. See [STORIES.md](STORIES.md) for full dialogue examples.

**Across sessions (stretch)** — user comes back days/weeks later with new context. Agent loads profile from DB and picks up where it left off.

## Staged pipeline architecture

The current scope is the clarify stage only. Research, plan, and iterate stages are deferred.

```
┌─────────────┐
│  1. CLARIFY  │ ──► UserProfile
│              │
│ Classify goal│
│ Handle intake│
│ Collect fields│
│ Build profile│
└─────────────┘
```

Stage behavior, prompts, and rules are documented in [`stages/`](stages/).

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

### Stage boundary validation

The clarify stage output is validated with `UserProfileSchema`. If the LLM produces output that fails validation, the pipeline stops immediately and sends an `error` event — no retry. A malformed output means the LLM fundamentally misunderstood the task, and retrying the same prompt is unlikely to help. The user starts a new session.

### OpenAI failure handling

All OpenAI API calls use retry with exponential backoff (3 attempts). If all retries fail, nothing is saved. The pipeline sends an `error` event via WebSocket and the user retries from scratch.
