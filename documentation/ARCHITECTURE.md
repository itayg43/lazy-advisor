# Lazy Advisor — Architecture

An agentic investment planning CLI for beginner ETF investors. Inspired by the Israeli "Lazy Investor" philosophy — invest in ETFs, set up monthly contributions, stick to the plan, don't overthink it.

> Educational/demonstrative project — not a licensed financial advisor. Target audience: beginner investors getting started, not experienced traders.

## Pipeline Overview

Stage behavior, prompts, and rules are co-located with the stage at `src/server/pipeline/stages/clarify/`.

```mermaid
flowchart TD
    Start([goal: string]) --> Classify[classify]
    Classify -->|normal| EfDebt[ef-debt]
    Classify -->|out_of_scope| OOS[intake: handleOutOfScopeRedirect]
    Classify -->|unrealistic| Unreal[intake: handleUnrealisticExpectations]
    Classify -->|contradictory| Contra[intake: handleContradictoryRisk]

    OOS -->|accepted| EfDebt
    OOS -->|rejected| End([end session])
    Unreal -->|accepted| EfDebt
    Unreal -->|rejected| End
    Contra -->|accepted| EfDebt
    Contra -->|rejected| End

    EfDebt --> Amount[amount]
    Amount -->|amount unresolved| ExitAmount([exit: amount unresolved message])
    Amount --> Timeline[timeline]
    Timeline -->|timeline unresolved| ExitTimeline([exit: timeline unresolved message])
    Timeline --> ShortHorizon{timeline < 3yr?}
    ShortHorizon -->|yes| ExitShort([halt: money market fund redirect])
    ShortHorizon -->|no| Risk[risk]
    Risk -->|risk_tolerance unresolved| ExitRisk([exit: risk unresolved message])
    Risk --> Allocation[allocation]
    Allocation -->|allocation unresolved| ExitAllocation([exit: allocation unresolved message])
    Allocation --> Contribution[contribution]
    Contribution --> Profile([UserProfile])
    Contribution -.->|planned| Equity[equity]
    Equity -.->|planned| Buffer[buffer]
    Buffer -.-> Profile
```

| Phase | Job | Input → Output |
|-------|-----|----------------|
| classify | Label the goal: `normal`, `out_of_scope`, `unrealistic`, or `contradictory` (`GoalClassificationEnum`) | `goal` → `GoalClassification` |
| intake | Redirect misclassified goals; reject if user declines | `goal`, classification → `IntakePhaseOutput` |
| ef-debt | Educate/warn about emergency fund and high-interest debt; gate before parameter collection | — → (educational gate, no profile output) |
| amount | Collect the investment amount as an integer in shekels | — → `AmountPhaseResult` |
| timeline | Collect the investment timeline as one of four horizon buckets | — → `TimelinePhaseResult` |
| risk | Elicit a 1–5 self-rating of comfort with temporary drops; map deterministically to `conservative`/`moderate`/`aggressive` | — → `RiskPhaseResult` |
| allocation | Size the total-portfolio equity/buffer split from a 2-axis (riskTolerance × timeline) anchor table keyed on the 1–5 score directly | amount, timeline, riskTolerance → `AllocationPhaseResult` |
| contribution | Establish one-time vs. periodic intent | amount, equityPercentage → `ContributionPhaseResult` |
| equity | *(planned)* Resolve which equity instruments fill the equity bucket + within-equity split | amount, timeline, riskTolerance, equityPercentage, plansToContribute → `EquityPhaseOutput` |
| buffer | *(planned)* Resolve which buffer instrument fills the buffer bucket | amount, timeline, riskTolerance, bufferPercentage, equity allocations → `BufferPhaseOutput` |

Phases use one of three conversation patterns depending on how code and the LLM divide control of the flow — see [Phase conversation patterns](#phase-conversation-patterns) below. A `*.rules.md` file is co-located with each phase as the behavior spec that drives prompts and evals. Per-phase schemas, types, and constants are co-located with each phase (e.g., `allocation/clarify.allocation.schemas.ts`). Cross-phase shared primitives (goal classification, halt/unresolved enums, `ClarifyStageResult`, shared phase helpers) live under `clarify/shared/`.

---

## Design Decisions

### Multi-phase split

Splitting by responsibility keeps each prompt short and focused, improving instruction-following. Phases are decoupled: they receive plain typed inputs from the orchestrator rather than accumulating conversation state across boundaries. Evals are more targeted — each phase is tested independently, assertions are tighter, and failures are easier to isolate. Evals run in two layers: schema/behavior assertions (every phase) plus an optional dev-only LLM-as-judge that scores prose quality against a rubric (a pilot on allocation — see [TESTING § Quality judging](TESTING.md#quality-judging-llm-as-judge)).

### Phase conversation patterns

Three patterns are used depending on how code and the LLM divide control of the conversation flow.

**`runPhaseLoop` — LLM as orchestrator**

The LLM reads a full system prompt describing the conversation flow and calls the `ask_user` tool to send messages and collect responses. Full conversation history is maintained server-side via `previous_response_id` — the LLM needs to remember what it has already asked and what the user said to know what step it is on. History is state.

Used when the LLM needs to generate dynamic content and navigate multi-step flows where the next action depends on nuanced judgment that does not benefit from being auditable in code: intake handlers.

**`askWithClassify` — code as orchestrator, single fixed question**

Code drives the conversation — decides what question to ask and in what order. The LLM does one narrow job per call: classify a single user response into a typed schema. Code calls `sendToUser`/`waitForResponse` directly (the same primitives `ask_user` is built on). State lives in TypeScript variables, not conversation history.

A scoped conversation history is maintained client-side within a single question's retry session — enough for the LLM to understand follow-up clarifying questions in context, but not shared across questions. This is not a substitute for `previous_response_id`; it serves a different, smaller purpose: contextual quality of clarification answers, not state tracking.

Used when questions are fixed and answers need structured extraction: ef-debt, amount, timeline, risk, contribution.

**`runConversation` — code as orchestrator, multi-turn negotiation**

Code drives a multi-turn loop where the next action depends on classifying each user reply. Per turn, the handler runs a classification LLM call against the conversation history, branches on the classified intent in code, and may run additional LLM calls (e.g., to compose a free-text reply).

Two handler slots are exposed. `initHandler` runs once before any user input — it produces the opening Ask or, when the phase has nothing to do (e.g., T6's `bufferPercentage === 0` early-skip), returns Done immediately, with or without a closing message. `turnHandler` runs after each user reply and receives the threaded state. Splitting the two means the turn signature doesn't have to model "no reply yet."

State is threaded through handler return values: each turn the handler receives `Readonly<TState>`, derives a new state via spread, and returns `{ kind: Ask, state, message }` or `{ kind: Done, result, message? }` (message optional on Done so phases can terminate silently or with a closing line). Ownership is split deliberately: the runner owns `history` because it's coupled to user I/O; the caller owns `TState` because it's coupled to phase domain logic, including turn accounting and convergence.

The per-turn branching logic (e.g., "first counter-proposal vs. Nth", "extreme deviation triggers sanity check") lives in TypeScript, not in the prompt. This extends the `askWithClassify` principle — use control flow for control flow, prompts for what code cannot do (free-text classification + free-text generation) — to multi-turn flows. Convergence is the handler's responsibility: handlers self-limit via turn counters in the threaded state.

Used for multi-turn negotiation with deterministic per-turn branching: allocation.

**The boundary**

| Need | Pattern |
|------|---------|
| Questions are fixed; answers need classification | `askWithClassify` |
| Code drives multi-turn flow; LLM classifies + composes per turn | `runConversation` |
| LLM decides what question to ask next or generates the flow dynamically | `runPhaseLoop` |

### Phase error contract

Both conversation patterns share the same error contract: internal runners throw typed errors; phases catch them narrowly and translate to an in-band result; the stage reads a typed `reason` field — it never handles raw exceptions for expected outcomes.

**Why in-band results at the phase boundary.** Errors-as-values pattern (Rust/Go heritage, idiomatic in modern TypeScript): expected outcomes are values you branch on, exceptions are reserved for genuinely unexpected failures. The stage branches on each result's status and reason (`amount` unresolved exits differently from `timeline` unresolved) — using exceptions would force try-catch-rethrow at every phase call.

**Status taxonomy (`PipelineStatusEnum`).** Every phase and stage reports one of four statuses:

- `completed` — contract honored, pipeline continues.
- `halted` — contract honored, pipeline stops *by design* (today: `short_timeline`, `intake_rejected`).
- `unresolved` — phase couldn't gather required data, user-driven (today: missing amount/timeline/risk_tolerance, allocation didn't converge).
- `errored` — system-driven failure where our code/model misbehaved (today: classify output failed resolved-schema validation, classify message was missing mid-loop).

**Primitive → phase result mapping.**

- `runPhaseLoop` → throws `PhaseLoopToolCallsExhaustedError` when its tool-call budget is exhausted → phase catches, returns `{ status: "unresolved", reason: "..." }`
- `askWithClassify` → throws one of three typed errors:
  - `ClassifyFollowUpsExhaustedError` when follow-ups are exhausted → user-driven; phase returns `unresolved`
  - `ClassifyResolvedOutputInvalidError` (extends `SchemaValidationError`, carries `ZodError` cause) when post-convergence resolved-schema validation fails → system-driven; phase returns `errored: "classify_resolved_output_invalid"`
  - `ClassifyMessageMissingError` when the model returns `clarificationNeeded=true` with `clarificationMessage=null` mid-loop → system-driven; phase returns `errored: "classify_message_missing"`

Non-collapsing phases (amount, timeline, risk) translate these errors via the shared `mapClassifyError` helper, which performs the error-to-result mapping (and the corresponding log emission) in one place rather than per-phase. Collapsing phases (ef-debt, contribution) use `isClassifyError` instead to short-circuit all three errors into a single safe default.

The two-schema pattern (loose `XClassifySchema` for the model, strict `XClassifyResolvedSchema` for post-convergence) lives inside `askWithClassify`; phases supply both and consume a non-null domain field.

Uncaught exceptions from either runner — unexpected errors, OpenAI failures — propagate up to the clarify orchestrator (`runClarifyOrchestrator`), which catches them at the stage boundary, logs the error, and converts them into a `{ status: "errored", message: SYSTEM_ERROR_EXIT_MESSAGE }` result. The pipeline orchestrator then delivers the message via `responder.sendToUser`. Only expected, graceful UX outcomes are surfaced as result variants from phase functions.

**Pipeline control-flow errors — `PipelineControlFlowError`.** The exhaustion errors thrown by pipeline runners — `PhaseLoopToolCallsExhaustedError` (`runPhaseLoop`) and `ClassifyFollowUpsExhaustedError` (`askWithClassify`) — share a common base class, `PipelineControlFlowError`. It is a sibling to `BaseError` and carries no HTTP `status`: these errors are caught at the phase boundary and translated to in-band results, so they never reach the HTTP layer. The base captures the semantic distinction from genuine system failures (`InternalError` for code/model bugs; `SchemaValidationError` for schema breaches like `ClassifyResolvedOutputInvalidError`), which continue to propagate as exceptions and convert to `SYSTEM_ERROR_EXIT_MESSAGE` at the stage boundary. Phases catch the specific subclass via its predicate (`isPhaseLoopExhaustedError`, `isClassifyError`) rather than the base — each subclass is independently mapped to its own `unresolved` reason or, where the phase opts in, a `completed` default.

`runConversation` is intentionally an outlier here: it has no *control-flow* exhaustion error. Convergence is the handler's responsibility — handlers self-limit via turn counters in the threaded state and return `Done` with the appropriate phase-result variant (`completed` or `unresolved`) on their own terms; the runner has no notion of the real turn budget. It does carry a required `hardStopTurns` backstop — a generous ceiling on asks emitted (allocation passes `ALLOCATION_MAX_TOTAL_TURNS + 1`: the last legitimate ask is emitted while the runner's ask count equals `ALLOCATION_MAX_TOTAL_TURNS`, so the `+ 1` clears it yet still catches a handler that keeps asking past its own budget) — but breaching it means a handler stopped self-limiting, i.e. a bug. So it throws `RunConversationHardStopError` (an `InternalError`, *not* a `PipelineControlFlowError`): it propagates to the orchestrator and converts to `errored`, rather than being mapped to a soft `unresolved`. The same applies to `RunConversationUnhandledOutputKindError` (the exhaustive-guard `InternalError`). A `runConversation` phase (e.g. `collectAllocation`) therefore has no try/catch of its own — an infra/model throw that survives SDK retries (a post-retry OpenAI failure mid-negotiation) deliberately stays uncaught and propagates to the orchestrator boundary, which logs it once and converts it to `errored`/`SYSTEM_ERROR_EXIT_MESSAGE`. A phase-local catch would only re-log an error the service layer already logged and re-map an honest infra failure into a softer status.

#### Next-tier — error contract

**Reasons as both domain and presentation keys.** `ClarifyUnresolvedReason` (`amount | timeline | ...`) currently doubles as a domain concept *and* a UI dispatch key. A more decoupled design would keep the domain reason pure ("amount_unresolved") and add a separate presentation layer mapping domain reasons to user-facing strings — enabling i18n, per-tier copy, and A/B test instrumentation without phase refactors. Defer until a real requirement forces it.

### Stage vs. orchestrator split

`runClarifyStage` (`clarify.stage.ts`) is pure: it returns a `ClarifyStageResult` discriminated union and never sends user-facing messages or handles unexpected errors. `runClarifyOrchestrator` (`clarify.orchestrator.ts`) wraps it with two responsibilities and emits no user-facing I/O of its own:

1. **Stage error boundary** — any thrown exception is caught, logged, and converted to an errored result carrying `SYSTEM_ERROR_EXIT_MESSAGE`. The stage stays exception-free in its return contract.
2. **Termination resolution** — `halted` / `unresolved` / `errored` results map to user-facing strings via `CLARIFY_HALT_MESSAGES`, `CLARIFY_UNRESOLVED_MESSAGES`, and `INTAKE_REDIRECT_REJECTION_MESSAGES`, then wrapped as `{ status, message }` preserving the original status. The `completed` arm returns `{ status: "completed", profile }`.

`ClarifyOrchestratorResult` is the boundary contract: non-completed variants collapse into a single `{ status, message }` shape, hiding stage-internal reason vocabulary (halt reasons, unresolved reasons, etc.) from the pipeline orchestrator so termination dispatch can't accidentally couple to inner variants.

`runPipelineOrchestrator` is the thin top-level wrapper that runs all stages inside `runWithSession`, switches on each stage's result status, and delivers any terminal message via `responder.sendToUser`. It holds no error-handling logic of its own.

#### Next-tier — orchestrator

**Inline effects vs. effect lists.** Orchestrators currently perform `logger.error` and `sendToUser` calls inline. A more rigorous design would have dispatch functions *return* a list of effects (`[{ type: "log", level, payload }, { type: "send", message }]`) and a thin runner execute them at the top — trivially testable, enables middleware (telemetry, analytics, rate limiting). The pattern Redux-saga / Effect.ts encode. Overkill for current scope; worth knowing as the next level of abstraction if orchestration logic grows.

**Generic stage termination resolver.** If/when a second stage lands, the per-stage `resolveTerminationMessage` shape will repeat. The right moment to extract a `resolveTermination<TResult>(result, messages)` helper is when there are 2–3 real call sites — not before.

### Architectural alternatives surveyed

The pipeline uses discriminated-union result types and an in-process orchestrator. Alternatives considered for the error-handling and orchestration shape:

- **Throw + catch everywhere (traditional OOP / older Node).** Loses type-safety on what errors can occur; every layer needs try/catch discipline. Rejected.
- **Effect.ts / fp-ts.** Encodes errors, dependencies, and async in the type — fully composable, fully type-safe. Real cost: heavy learning curve, young ecosystem, ties the team to a paradigm. Deferred; reconsider only if orchestration logic grows substantially.
- **State machines (XState).** Visualizable transitions, every state explicit. Heavyweight for current scope (linear conversation, no complex branching). Deferred.
- **Durable execution (Temporal, AWS Step Functions, custom workflow engines).** The production-scale pattern Stripe / DoorDash / Uber use for multi-step user flows: each step persists, survives restarts, has built-in retries and observability. It is an *infrastructure choice that sits underneath this code*, not an alternative to it. Worth knowing as the next-tier evolution at production scale.
- **Event-driven / pub-sub.** Used for cross-service coordination, not in-process pipelines. Wrong tool for the current shape.

### Classify + intake routing

Some goals require handling before parameter collection: stock-picking requests need an ETF redirect, unrealistic return expectations need a reality check. Embedding that branching in a parameter-collection prompt would create a mega-prompt where routing logic competes with collection instructions, degrading adherence.

The solution: move routing into code. A lightweight classifier (`classifyGoal`) makes a single structured LLM call and returns one of four values — `normal`, `out_of_scope`, `unrealistic`, or `contradictory`. Code routes to the appropriate intake phase before parameter collection:

```
"Should I buy NVIDIA stock?"
  → classifyGoal()             → out_of_scope
  → handleOutOfScopeRedirect   → IntakePhaseOutput { accepted: true }
  → collectEfDebt()
  → collectAmount() → collectTimeline()
  → collectRisk() → collectAllocation(amount, timeline, riskTolerance) → ... → UserProfile
```

Each intake handler lives in its own subfolder under `clarify/intake/` alongside its evals. Each is a sub-agent: its own system prompt, its own `runPhaseLoop`, and a typed `IntakePhaseOutput`. Acceptance is determined by a post-loop structured LLM call:
- `{ accepted: true }` — user accepted the redirect; stage continues to parameter collection
- `{ accepted: false }` — stage returns `{ status: "halted", reason: "intake_rejected", classification }`; the orchestrator dispatches the per-classification closing message from `INTAKE_REDIRECT_REJECTION_MESSAGES`

The amount and timeline prompts are each left with one job: collect a single required profile parameter.

An alternative considered: skip the classifier and expose handlers as LLM tools, letting a top-level agent route via tool call. This breaks down because the handlers are multi-turn conversations — the outer agent would just wait, making it an expensive classifier with no upside. Explicit code routing after a lightweight classifier is cheaper, independently testable, and observable in isolation.

(The `contradictory` classification is kept despite the risk phase's self-rating resolving the stated contradiction — surfacing the conflict up-front has educational value for beginner users.)

### Amount & timeline — hard exits on missing data

`collectAmount` returns `{ status: "unresolved", reason: "amount" }` if the user cannot provide a valid investment amount after two attempts, and the stage propagates the result so the orchestrator dispatches the exit message. Every downstream phase is shekel-denominated — allocation splits, contribution framing, and equity/buffer amounts all depend on a concrete number. Timeline shares the same hard-fail pattern: if the user cannot provide a specific timeframe after two attempts, `collectTimeline` returns `{ status: "unresolved", reason: "timeline" }`. Timeline is the other axis of the allocation anchor table; a guessed timeline produces a wrong equity/buffer split. Amount and timeline are separate single-value phases collected in sequence (amount first); each carries its own unresolved reason, so the stage propagates the phase result directly without re-deriving which value is missing.

### Short-horizon early halt (timeline < 3 years)

After timeline collection, the stage compares the destructured `timeline` against `SHORT_TIMELINE_BUCKET`. If it matches (`"under 3 years"`), the stage returns `{ status: "halted", reason: "short_timeline" }` — the orchestrator dispatches a money market fund redirect. ETFs carry too much timing risk for money needed within 3 years: a market drop right before the funds are needed is hard to recover from in time, and risk tolerance is not a meaningful variable at that horizon (Vanguard, Fidelity, Bogleheads).

### Risk phase — single 1–5 self-rating

The risk phase asks one question: a 1–5 self-rating of comfort with seeing investments drop temporarily, with behavioral anchors at 1 ("very uncomfortable — I'd want to sell immediately"), 3 ("neutral — I'd be uneasy but try to hold"), and 5 ("completely comfortable — I'd see it as a buying opportunity"). The phase emits only `riskTolerance` — the raw 1–5 integer, nothing else. The downstream allocation phase keys its anchor table on that score directly; there is no `conservative`/`moderate`/`aggressive` bucket. `riskTolerance` is consumed only by allocation and is never persisted on the profile.

**Why direct self-rating, not hypothetical drop scenarios.** Risk-tolerance research (Statman, Kitces, CFA Institute *Psychometric Review*) shows direct self-rating has higher predictive validity than hypothetical scenarios, and historical-recovery framing is a documented priming bias. An earlier two-turn A/B design also exhibited an intermittent adherence flake (~1 in 3–4 runs); the single-question shape removes the multi-step flow structurally. Full trade-offs and rejected alternatives in [`clarify.risk.research-notes.md`](../src/server/pipeline/stages/clarify/risk/clarify.risk.research-notes.md).

**Hard-fail on unresolved.** If the retry budget is exhausted without a valid 1–5 score — whether from invalid answers or from a clarifying question consuming turns — `collectRisk` returns `{ status: "unresolved", reason: "risk_tolerance" }`. The orchestrator dispatches a closing message rather than the stage defaulting to an assumed risk tolerance — risk tolerance is the other axis of the allocation anchor table, so an assumed value produces a misleading allocation. Mirrors the `timeline` hard-fail pattern.

**`riskTolerance` is the phase's only output** and the allocation phase consumes it directly: it both selects the anchor row and calibrates the landing point within the row's range (e.g., a "5" anchors to the high edge, a "4" to the low edge of the same range). Keeping all anchor logic in allocation means granularity belongs there, not in classification.

**Willingness-only, no external context.** No timeline, age, or amount is passed to the phase. When users ask capacity questions ("does my timeline change what score I should give?"), the correct behavior is to deflect — acknowledge that capacity and willingness are distinct, then re-present the scale. Surfacing the timeline would reintroduce the framing bias the design avoids.

### Allocation phase — 2-axis anchor (risk tolerance × timeline)

The allocation phase resolves the total-portfolio split between equity (stocks / stock ETFs) and buffer (cash, money-market funds, short-term bonds). Output is two integers summing to 100. Instrument selection belongs to the planned equity and buffer phases.

**Why a separate phase.** Risk classification is only half the behavioral protection — sizing the equity bucket to tolerance is what makes the classification actionable. A conservative user at 40% equity experiences a 20% stock drop as an 8% total-portfolio drop, which contains the panic-sell behavior they self-reported.

Code locates the user's cell from `riskTolerance` × `timeline` (the anchor table is keyed on the 1–5 score directly, with rows 1≡2 and 4≡5 duplicated), then picks a specific integer inside the cell's range via `deriveAnchorEquityPercentage` — all deterministically, no LLM call. The anchor table covers three timelines: `3–5 years`, `5–10 years`, `10+ years` (users with `"under 3 years"` exit before reaching this phase). Rules and anchor table live in [`clarify.allocation.rules.md`](../src/server/pipeline/stages/clarify/allocation/clarify.allocation.rules.md); research basis in [`clarify.allocation.research-notes.md`](../src/server/pipeline/stages/clarify/allocation/clarify.allocation.research-notes.md).

**Shekel math discipline.** The prompt includes explicit arithmetic instructions (`equity = amount × equityPercentage ÷ 100`; `buffer = amount − equity`; verify sum before sending) with a worked example. An earlier eval run surfaced a bug where the model stated "₪85,000 + ₪15,000" for a ₪50,000 investment; every eval case now asserts the transcript contains correct shekel amounts.

**What's not consumed by this phase.** Emergency fund and debt status are addressed in the ef-debt phase and are not passed to this phase.

**Unresolved-split exit.** `collectAllocation` returns `{ status: "unresolved", reason: "allocation" }` when the negotiation doesn't converge — either the user keeps counter-proposing past `ALLOCATION_MAX_NEGOTIATION_TURNS`, or the conversation runs past `ALLOCATION_MAX_TOTAL_TURNS` total turns (a separate backstop that also counts clarifying questions, which the negotiation budget deliberately does not). The orchestrator dispatches a closing message rather than locking the user into a split they were still negotiating.

### Contribution phase — `plansToContribute: boolean`

Users contribute on irregular schedules, and a fixed monthly number creates false precision — hard to collect accurately and likely to mislead downstream projections. A boolean is sufficient for the downstream use case (adjusting plan examples for "contributes periodically" vs. "one-time investment").

**Allocation context passed to contribution.** The contribution phase receives the investment `amount` and `equityPercentage` as primitives. Equity and buffer shekel amounts are pre-computed in TypeScript from those primitives before being injected into the prompt — the model is not asked to do the arithmetic. The prompt then references the user's settled equity and buffer amounts when explaining DCA mechanics and Israel-specific concerns (e.g., "With your ₪21,000 in equity and ₪9,000 in buffer..."). The opening question remains generic; the allocation context surfaces only in explanations that are materially improved by knowing the actual split.

---

## Cross-cutting Concerns

### Phase loop guardrails

`runPhaseLoop` enforces a max tool call count to guard against the model not converging — exceeding the cap throws `PhaseLoopToolCallsExhaustedError`. `collectToolOutputs` rejects any tool that isn't `ask_user` and throws `InternalError` (a real bug, not a UX outcome).

### OpenAI failure handling

SDK-native retries (`maxRetries: 3`) absorb transient connection / 408 / 409 / 429 / 5xx failures. Anything that survives retries is classified by `openaiService` via `mapOpenAIError` into `ServiceUnavailableError`, `InternalError`, or `SchemaValidationError` — full mapping table in [CONVENTIONS § Error Handling](CONVENTIONS.md#error-handling). Mapped exceptions propagate to the clarify orchestrator, which catches them at the stage boundary, logs the failure, and sends `SYSTEM_ERROR_EXIT_MESSAGE`. The user retries from scratch.

### Stage boundary validation

The clarify stage output is validated with `UserProfileSchema` before returning. A validation failure throws, propagating to the clarify orchestrator's catch block, which logs the error and sends `SYSTEM_ERROR_EXIT_MESSAGE` — no retry. A malformed output means the LLM fundamentally misunderstood the task, and retrying the same prompt is unlikely to help.

### Inline assembly from typed outputs

An earlier design used a final LLM extraction call across the full conversation to assemble `UserProfile`. Replaced by inline assembly in `clarify.stage.ts`: phase results are now flat, so the stage destructures the primitives it needs from each (`amount` from the amount phase, `timeline` from the timeline phase; `equityPercentage` and `bufferPercentage` from allocation; `plansToContribute` from contribution) and passes them as named fields into `UserProfileSchema.parse()`. `riskTolerance` is kept on `RiskPhaseResult` for use by the allocation phase and is intentionally not propagated into the profile. With typed phase outputs, there is no summation or inference step — just field mapping.

### Session correlation

Each pipeline run is assigned a `sessionId` (UUID) at its entry point and propagated implicitly via `AsyncLocalStorage` (`src/server/lib/session-context.ts`). Every log call across all phases automatically carries `sessionId` — no phase function needs it as a parameter.

Concurrent sessions on the same server instance are fully isolated: `AsyncLocalStorage` tracks which async context each continuation belongs to, so interleaved log lines from different sessions each carry only their own `sessionId`. This is a concurrency guarantee, not a parallelism one — Node.js is single-threaded; isolation is achieved by the event loop restoring the correct store on each async resumption.

`runWithSession` is established once in `runPipelineOrchestrator` so the context spans all stages. Stages take no `sessionId` parameter — they simply inherit the ambient context from the orchestrator's wrapper.

