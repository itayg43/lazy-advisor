# Decision: Lazy Advisor

## Project name: `lazy-advisor`

Inspired by the Israeli "Lazy Investor" philosophy — invest in ETFs, set up monthly contributions, stick to the plan, don't overthink it. The agent helps beginners build the plan and then tells them to do nothing when they panic.

**This is a separate project/repo**, not part of ai-task-assistant. Fresh architecture designed for what this actually needs. The two projects complement each other on a CV: ai-task-assistant shows async microservices with RabbitMQ; lazy-advisor shows agentic workflows with multi-turn conversation and WebSocket streaming.

## What we're building

An agentic investment planning CLI for beginner ETF investors. The agent asks smart questions, researches current ETF data, and produces an actionable plan with phased steps. Within a session, the user can iterate on the plan. Across sessions (stretch goal), the plan evolves as the user's situation changes.

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
  ├── Tavily API                         → search tool execution
  └── Redis                              → rate limiting
```

### Client
CLI or React frontend. Connects to the backend via WebSocket for the entire session. Sends user messages, receives agent events.

### Backend Service
A single Express app that handles everything: client connections, pipeline execution, plan persistence, and external API calls. The pipeline runs in-process — no inter-service communication needed.

**Gateway layer**: Auth, rate limiting, session lifecycle, WebSocket connection management.

**Pipeline engine**: Runs the staged pipeline (Clarify → Research → Plan → Iterate) in-process. Each stage calls OpenAI and Tavily directly. Tool calls like `create_step` and `ask_user` are direct function calls — no HTTP or message passing between services.

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
- **Complements ai-task-assistant**: ai-task-assistant demonstrates async microservices with RabbitMQ. lazy-advisor demonstrates a different pattern — agentic workflows with real-time streaming. Two projects, two architectures, both production-informed.
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

**Within a session (MVP)** — the CLI stays open. The agent clarifies, plans, and asks if the user wants to adjust. Back-and-forth continues until the user is satisfied:

```
$ lazy-advisor "I want to invest $10k in ETFs"

Agent: A few questions to tailor your plan:
  1. What's your investment timeline?
  2. Risk tolerance — could you stomach a 20% drop?
  3. Do you have a brokerage account?

You: 5+ years, moderate, no

Agent: Researching...
  ✓ Searched "best moderate risk ETFs 2026"
  ✓ Searched "Fidelity vs Schwab brokerage comparison"

Plan:
  Phase 1: Open Fidelity brokerage account
  Phase 2: Buy $4k VTI | Buy $3.5k VWO | Buy $2.5k BND
  Phase 3: Set up $500/mo auto-invest: 40/35/25

  Anything you'd like to adjust?

You: skip bonds, put it all in equities

Agent: Updated:
  Phase 2: Buy $5.5k VTI | Buy $4.5k VWO
  Phase 3: Set up $500/mo auto-invest: 60/40

  Anything else?

You: looks good

Agent: Plan saved.
```

**Across sessions (stretch)** — user comes back days/weeks later with new context (executed steps, market events, new money). Agent loads profile + plan from DB and picks up where it left off.

## Locale awareness

The agent asks where the user is located (or infers from context) and tailors recommendations accordingly — ETF types, brokerages, and tax implications all change by country.

**Example: Israeli investor**

The agent explains the tradeoffs and lets the user decide:

```
Agent: Since you're in Israel, I should explain your options — there are
  three types of funds available to you, each with different tradeoffs:

  • Israeli index funds (קרנות מחקות) — traded on TASE in ILS.
    Managed by local firms (Migdal, Harel, KSM). No currency conversion
    needed, simple tax reporting, and some track the same global indices
    as foreign ETFs. Expense ratios are higher than US/Irish (0.2-0.8%)
    but the convenience and tax simplicity can make up for it.

  • Irish accumulating ETFs (like VWRA, CSPX) — traded on European exchanges.
    Dividends are reinvested automatically inside the fund. Only 15% is
    deducted internally (US-Ireland treaty rate) instead of 25% Israeli
    dividend tax. You don't pay Israeli tax until you sell. Best for
    long-term tax efficiency, but you need a broker with access to
    European exchanges (like Interactive Brokers).

  • US ETFs (like VTI, VOO) — traded on US exchanges. Lowest expense ratios
    (0.03%). But dividends are distributed and taxed at 25% in Israel every
    time they're paid out. That's money leaving your portfolio regularly.
    Also requires USD currency conversion.

  For long-term investors, Irish ETFs usually win on tax efficiency. Israeli
  funds win on simplicity. US ETFs win on cost but lose on dividends tax.

  Do you have a preference, or want me to recommend based on your situation?
```

The agent educates and recommends, but respects the user's choice. **Fund type and broker are independent decisions.** An Israeli user can choose Israeli index funds through a local broker, or US ETFs through Interactive Brokers, or any other combination — the agent explains the tradeoffs of each pairing and lets the user decide.

### Broker recommendations are locale-aware

The agent recommends brokers that are available and relevant in the user's country — not just international options:

| Location | Brokers | Notes |
|----------|---------|-------|
| **US** | Fidelity, Schwab, Vanguard | Commission-free ETFs, auto-invest support |
| **Israel** | Meitav, IBI, Psagot | Access to TASE (Israeli index funds) AND international exchanges (US/Irish ETFs). Interactive Brokers is also an option for international-only. |

Israeli brokers offer access to both local and international markets — the user does NOT need Interactive Brokers to buy US or Irish ETFs. Local brokers may charge higher commissions on international trades, but the convenience of a single account matters. The agent explains the tradeoffs (fees, platform UX, market access) and lets the user choose.

### What changes per locale

Different locales change: available brokerages (local and international), ETF/fund tickers, tax treatment (dividend withholding rates, capital gains rates), currency considerations, and regulatory constraints.

## Adaptive clarifying questions

The agent does NOT ask a fixed list. It analyzes the user's input, identifies what it already knows, and only asks about gaps. Detailed input → skip clarification entirely. Location is one of the key gaps to fill early — it affects almost every recommendation.

## Agent mental model: research is work, not a task

The agent does the research, the human does the actions. Steps like "Research VGT vs QQQ" are the agent's job — not the user's.

- **Research/analysis** → agent does this NOW via search tool, synthesizes findings
- **Human action items** → become steps, enriched with research as context

Steps should be specific, opinionated, and informed.

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

### Stage 1: CLARIFY
- **System prompt**: Focused on understanding the user — detect risk tolerance, timeline, amount, experience level, and boundaries (unrealistic expectations, out-of-scope requests)
- **Input**: User's raw goal text
- **Output**: Structured user profile (`{ amount, age, risk, timeline, location, brokerage, hasEmergencyFund, hasDebt, monthlyContribution, gaps_to_ask }`)
- **Required profile fields**: `amount`, `age`, `risk`, `timeline`, `location`, `hasEmergencyFund`, `hasDebt`, `monthlyContribution`. The agent must gather all of these — either from the user's input or by asking. If the user provides enough detail upfront, skip questions for fields already covered. Never proceed to Stage 2 with missing required fields.
- **Optional profile fields**: `brokerage`. If not provided, the agent recommends one based on location and needs.
- **Behavior**: If input is detailed enough, skip questions. If contradictory, educate. If out of scope, redirect.
- **Events**: `clarification` (questions to user), `message` (educational explanations)

### Stage 2: RESEARCH
- **System prompt**: Focused on financial research — what to search, how to evaluate ETFs, what data points matter
- **Input**: Structured user profile from stage 1
- **Output**: Structured research summary (`{ recommended_etfs: [{ ticker, er, reasoning, risks, source_url }], brokerage_recommendation, allocation_rationale }`). Each recommendation includes a `source_url` so the user can verify the data. Research freshness is derived from the plan's `createdAt` in the DB — no separate timestamp needed.
- **Key**: Raw search results are summarized and compressed here. Stage 3 never sees the raw HTML/text — only the structured summary. This is what keeps context clean.
- **Search failure**: Searches use retry with exponential backoff (3 attempts). If all retries fail, the **pipeline stops at the code level** — Stage 3 never runs. The CLI receives an `error` event via WebSocket: "I wasn't able to retrieve current financial data right now. I don't want to build a plan without verified information — please try again in a few minutes." This is a code-level gate, not an LLM decision — no amount of prompt injection can make the agent skip research and proceed with unverified data. The pipeline physically won't advance without Stage 2's structured output (including `source_url`s).
- **Events**: `search_progress` (✓ Searched "...")

### OpenAI failure handling

All OpenAI API calls (every stage) use retry with exponential backoff (3 attempts). If all retries fail, behavior depends on whether a plan already exists in the DB:

- **No plan yet** (Stage 1 or 2 failure): Nothing is saved. Send `error` event via WebSocket, user retries from scratch.
- **Mid-plan** (Stage 3 failure): Any steps already created are persisted, but the plan is incomplete. Send `error` event. User can start a new session.
- **Plan already complete** (Stage 4 failure): The user's previous completed plan is safe in the DB. Send `error` event via WebSocket: "Couldn't process your last change, but your previous plan is saved."

Incremental persistence means the worst case is losing the current LLM invocation's remaining tool calls — never steps that were already created.

### Stage 3: PLAN
- **System prompt**: Focused on plan generation — explain concepts inline, be educational and opinionated, create phased steps with reasoning
- **Input**: User profile + research summary (both structured, both small)
- **Output**: Structured plan (phases, steps, reasoning, summary)
- **Behavior**: Verbose and educational — every recommendation includes *why*
- **Events**: `step_created` (steps appearing one by one), `plan_complete`

### Stage 4: ITERATE (loop with feedback classification)

Stage 4 is the decision point. Before acting on user feedback, the agent classifies it into one of three types. This classification determines whether the pipeline loops back for new research or handles the change locally.

- **System prompt**: Two-step process. First: classify the feedback (cheap/fast model — this is a routing decision, not a creative task). Second: act on the classification (full model for `adjust`, or re-enter Stage 2 for `research_and_adjust`).
- **Input**: Current plan + user profile + user's feedback message (NOT the full conversation history)
- **Output**: Classification (cheap model) + updated plan or re-entry to Stage 2 (full model)

**Feedback classification:**

| Type | Trigger | Pipeline action | Example |
|------|---------|----------------|---------|
| **`adjust`** | Can be resolved with existing research | Stay in Stage 4, modify plan | "skip bonds, put it all in equities" / "make it 60/40" |
| **`research_and_adjust`** | Introduces something the agent hasn't researched | Update profile, loop back to Stage 2 → 3 → 4 | "I want more tech" / "actually I'm in Israel" / "what about clean energy?" |
| **`clarify`** | Ambiguous feedback or a question — not actionable yet | Ask follow-up question, wait for response, re-classify | "I'm not sure about the bonds part" / "what's the difference between VTI and VOO?" / "is that too risky?" |
| **`done`** | User is satisfied | End session | "looks good" / "that's what I want" |

- **Behavior**: Each iteration is a fresh LLM call with only the current plan + user profile + latest feedback. No context accumulation. For `clarify`, the agent asks a targeted follow-up (using `ask_user`) and re-classifies the user's response — this does not count toward the iteration limit since no plan change occurred. For `adjust`, the agent uses `update_step`/`remove_step`/`create_step` to modify the plan in place — no re-research needed. For `research_and_adjust`, the profile is updated before re-entering Stage 2, so the new research is scoped to what changed.
- **Events**: `step_updated`, `step_removed`, `step_created`, `plan_complete`
- **Persistence**: Steps are persisted incrementally — each `create_step`, `update_step`, and `remove_step` call writes to DB immediately. `finish_plan` marks the plan as complete. This means even if the session drops mid-loop, any steps already created are durable. The `done` classification simply ends the session — it doesn't trigger a save.
- **Iteration limit**: Max 5 iterations in Stage 4. After that, the agent presents the current plan as final: "We've been through several rounds — here's your current plan. You can start a new session anytime to explore a different direction." Steps are already persisted incrementally, so nothing is lost.
- **Exit**: User says they're satisfied, iteration limit reached, or session closes.

### Stage boundary validation

Each handoff between stages is validated with a Zod schema: user profile (Stage 1 → 2), research summary (Stage 2 → 3), plan structure (Stage 3 → 4). If the LLM produces output that fails validation, the pipeline stops immediately and sends an `error` event — no retry. A malformed handoff means the LLM fundamentally misunderstood the task, and retrying the same prompt is unlikely to help. The user starts a new session.

### Why this matters

1. **No context degradation** — each stage starts fresh with a focused prompt and minimal input
2. **Search results don't pollute** — raw search text is summarized in stage 2 and discarded
3. **Validated handoffs** — Zod schemas at every stage boundary catch malformed LLM output before it propagates downstream
4. **Testable** — each stage can be tested independently (Story 3 tests clarify stage boundaries, Story 5 tests research stage honesty, Story 7 tests clarify stage education)
5. **Predictable** — the agent behaves consistently because no single prompt is trying to do everything
6. **Better engineering story** — "staged pipeline with structured handoffs" > "one big system prompt"

## Tools per stage

**Stage 1 (CLARIFY):**
- `ask_user(questions)` — ask adaptive questions, wait for response

**Stage 2 (RESEARCH):**
- `search(query)` — web search for current financial data (Tavily or similar). Stage-level cap on searches (in-memory counter). If the ceiling is hit, the agent builds the research summary from what it has — this is a graceful constraint, not an error.

**Stage 3 (PLAN):**
- `create_step(action, reasoning, phase)` — add a step to the plan
- `finish_plan(summary)` — finalize the plan

**Stage 4 (ITERATE):**
- `ask_user(questions)` — ask follow-up question for `clarify` classification. Wait for response, then re-classify.
- `search(query)` — if the user's feedback requires new research. Same stage-level search cap and graceful ceiling as Stage 2.
- `create_step(action, reasoning, phase)` — add a new step to the plan
- `update_step(step_id, action?, reasoning?, phase?)` — modify an existing step (any field). Used for `adjust` feedback like changing allocations or swapping ETFs within existing research.
- `remove_step(step_id)` — remove a step from the plan. Used for `adjust` feedback like "skip bonds" or "drop emerging markets."
- `finish_plan(summary)` — finalize the updated plan

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

## What makes this portfolio-worthy

- **Agentic tool-calling loop**: Agent decides when to search, when to ask, when to create steps, when to stop
- **WebSocket streaming**: Real-time bidirectional communication — user sends messages and sees searches happening and steps appearing live over a single connection
- **Human-in-the-loop**: Agent asks clarifying questions, user iterates on the plan within the session
- **Deliberate model selection**: Feedback classification uses a cheap/fast model for routing, full model for creative work — demonstrates choosing the right model for the task
- **Domain-specialized system prompt**: Deep financial knowledge drives thorough research and opinionated recommendations
- **Structured persistent output**: Plans with phases saved to PostgreSQL via Prisma, not throwaway chat text
- **Feedback classification**: Agent classifies user feedback to determine whether to adjust locally or loop back for new research — a real architectural decision point

**Stretch goals add:**
- Multi-session state management (living plan that evolves)
- Persistent user memory (agent gets smarter over time)
- Adaptive verbosity (less explanation as user learns)

## Positioning: CV and interview

### CV line

**Don't:** "Built an AI agent that creates investment plans using OpenAI"

**Do:** "Built an agentic investment planning system — staged pipeline with Zod-validated handoffs, real-time WebSocket streaming, feedback classification that routes user input through different pipeline paths, and a code-level safety gate that prevents plan generation without verified research data. Separate from [ai-task-assistant project] to demonstrate both async microservice architecture and conversational agentic workflows."

### Interview question: "What does this give you that ChatGPT doesn't?"

> "It's not a ChatGPT competitor. It's a portfolio project that demonstrates I can build production agentic systems — tool-calling loops with human-in-the-loop, WebSocket streaming, structured persistent output, session state management. The investment planner is the vehicle, the engineering is the point."

### Steering the conversation toward engineering

The financial domain is compelling but can hijack interviews — an interviewer might spend 15 minutes debating ETF picks instead of asking about the architecture. Lead with engineering:
- Demo and README should open with the architecture diagram, not the financial output
- Frame demos as "watch how the pipeline stages hand off structured data" not "look at this investment plan"
- If the conversation drifts into finance, redirect: "The recommendations come from the LLM + live search — the engineering challenge was making sure the pipeline won't produce a plan without verified research, which is why Stage 2 has a hard gate that physically prevents Stage 3 from running without validated search results."

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

### Why this matters for interviews

Observability turns "it works in the demo" into "I can tell you exactly where the bottlenecks are." Starting with request latency, error rates, and token usage per stage — then adding pipeline-specific metrics as the system matures — is a concrete signal that you think about production readiness, not just happy-path functionality.

## Review decisions

Reviewed against Dave Ebbelaar's (Datalumina) AI agent methodology. Full review in `CAPABILITY-REVIEW.md`.

### 1. Simplify safety caps — one per stage

The original plan had overlapping caps (10 tool-call cap, 8 search cap, 5 iterate search cap, 5 iteration limit). Collapsed to **one reasonable cap per stage**. Zod validation at stage boundaries **stays hard-fail** — if the LLM output doesn't match the schema, something is genuinely wrong and garbage should not propagate.

### 2. Feedback classification stays LLM-based

Considered deterministic pattern-matching for simple feedback (e.g., "skip bonds" → `remove_step`). Rejected — natural language is too varied for regex/keyword matching to be reliable. The cheap-model classifier is already the right trade-off: fast, cheap, handles real user input. Revisit only if classifier latency becomes a bottleneck.

### 3. Metrics — trivial ones only for MVP

Implement metrics that come free from existing middleware wrappers (request counts, latency histograms, error rates). Defer any metrics requiring custom plumbing. Add incrementally as the system matures.

### 4. Session memory — already implemented

The user profile passed as a structured object between stages already implements Dave's Memory building block. Cross-session memory is correctly deferred. No action needed.

## Technical notes

- **Separate repo**: `lazy-advisor` — not part of ai-task-assistant
- Uses `openai.chat.completions.create` with `tools`
- **Backend Service**: Single Express app with WebSocket endpoint. Gateway layer (auth, rate limiting, session lifecycle) + pipeline engine (stages, tool-calling, feedback classification) + plan domain (CRUD, persistence). PostgreSQL via Prisma.
- **Redis**: Rate limiting only. Session state is in-memory (upgrade path to Redis documented for horizontal scaling/reconnection).
- External dependency: Tavily API (search) — ~$0.01/search, free tier available
- CLI: Node.js, minimal — WebSocket client to the backend + stdin handling
- **One cap per stage** (prevents runaway loops). Each stage has a single reasonable cap on tool-call iterations. If hit, the orchestrator forces the stage to conclude with whatever it has:
  - **Stage 2 (Research)**: Build the research summary from searches completed so far (same graceful degradation as the search ceiling).
  - **Stage 3 (Plan)**: Force `finish_plan` with steps created so far. Send a `message` event noting the plan may be less detailed than intended.
  - **Stage 4 (Iterate)**: Same as Stage 3 — finalize with current state.
  - **Stage 1 (Clarify)**: Proceed to Stage 2 with whatever profile information was gathered. The agent may ask fewer questions than ideal, but the pipeline continues.
