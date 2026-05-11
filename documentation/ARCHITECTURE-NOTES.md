# Architecture Notes

Forward-looking notes that don't belong in [ARCHITECTURE.md](ARCHITECTURE.md) (which describes current-state design). This file captures pattern rationale, alternatives surveyed, and concerns deliberately out of scope today.

## Why result types over thrown exceptions

The pipeline uses discriminated-union result types (`status + reason`) for expected outcomes and thrown errors for unexpected failures. This is the Rust/Go "errors as values" pattern applied to TypeScript: expected outcomes are values you branch on; exceptions are reserved for genuinely unexpected failures.

This is the mainstream modern-TS approach, idiomatic in Rust/Go-influenced codebases (Stripe, Linear, Vercel internals, many fintech shops). The decision rule lives in ARCHITECTURE.md § "Phase error contract" — the orchestrator branches on result variants, not on catch blocks.

## Alternatives surveyed

- **Throw + catch everywhere (traditional OOP / older Node).** Loses type-safety on what errors can occur; every layer needs try/catch discipline. Rejected.
- **Effect.ts / fp-ts.** Encodes errors, dependencies, and async in the type — fully composable, fully type-safe. Real cost: heavy learning curve, young ecosystem, ties the team to a paradigm. Deferred; reconsider only if orchestration logic grows substantially.
- **State machines (XState).** Visualizable transitions, every state explicit. Heavyweight for current scope (linear conversation, no complex branching). Deferred.
- **Durable execution (Temporal, AWS Step Functions, custom workflow engines).** This is the production-scale pattern Stripe / DoorDash / Uber use for multi-step user flows: each step persists, survives restarts, has built-in retries and observability. It is an *infrastructure choice that sits underneath this code*, not an alternative to it. Worth knowing as the next-tier evolution at production scale.
- **Event-driven / pub-sub.** Used for cross-service coordination, not in-process pipelines. Wrong tool for the current shape.

## Out of scope today (required at production scale)

These concerns are orthogonal to the current code's *shape* — none would require rewriting what exists. They'd layer on:

- **Persistence at the session boundary.** Server restart mid-conversation = lost user progress. Production answer: every phase result persisted to a session store (Redis / Postgres) keyed by `sessionId`.
- **Cancellation via `AbortSignal`.** Closed browser tab = orphaned OpenAI calls + token burn. Plumb `AbortSignal` through `runPipeline` → phases → service.
- **Structured event log.** Logs today are unstructured. No replay, no drop-off analytics, no A/B test instrumentation. Production answer: emit typed events alongside logs, persist to an event store.
- **Retry orchestration at the pipeline level.** Today, if `runClarifyStage` throws unrecoverably, the user retries the whole flow. A workflow engine would resume from the last successful phase.
- **Multi-tenant isolation.** Single-process assumption everywhere — fine for CLI, a real concern for SaaS at scale.

## Next-tier improvements when needed

Patterns worth knowing for when the current scope grows:

- **Domain/presentation decoupling on reasons.** `ClarifyUnresolvedReason` (`amount | timeline | ...`) doubles as a domain concept *and* a UI dispatch key. A more decoupled design would keep the domain reason pure ("amount_unresolved") and add a separate presentation layer mapping domain reasons to user-facing strings. Enables i18n, per-tier copy, A/B test instrumentation without phase refactors. Defer until a real requirement (translation, role-based messaging) forces it.

- **Explicit effects.** Today the orchestrator does `logger.error` + `sendToUser` calls inline. A more rigorous design would have dispatch functions *return* a list of effects (`[{ type: "log", level, payload }, { type: "send", message }]`) and a thin runner execute them at the top. Trivially testable, enables middleware (telemetry, analytics, rate limiting). The pattern Redux-saga / Effect.ts encode. Overkill for current scope; worth knowing as the next level of abstraction if orchestration logic grows.

- **Generic stage termination dispatcher.** When a second stage (T5) lands, the per-stage `handleClarifyTerminationMessage` shape will repeat. The right moment to extract a `dispatchTermination<TResult>(result, messages)` helper is when there are 2–3 real call sites — not before. See PR #135 review discussion for a sketch.
