# Lazy Advisor — Architecture

An agentic investment planning CLI for beginner ETF investors. Inspired by the Israeli "Lazy Investor" philosophy — invest in ETFs, set up monthly contributions, stick to the plan, don't overthink it. The agent asks smart questions to clarify the user's investment situation and builds a structured investment profile.

> Educational/demonstrative project — not a licensed financial advisor. Target audience: beginner investors getting started, not experienced traders.

## Pipeline

```
┌─────────────┐
│  1. CLARIFY  │ ──► UserProfile
└─────────────┘
```

Stage behavior, prompts, and rules are co-located with the stage at `src/server/pipeline/stages/clarify/`.

## Clarify Stage — Phases

> **Refactor in progress.** The stage is being rewritten from `previous_response_id` chaining to a typed I/O pipeline. See [`CLARIFY_REFACTOR_PLAN.md`](../CLARIFY_REFACTOR_PLAN.md) for per-phase specs and status. The phase map below reflects the **target state**; current `main` still has the monolithic `preferences` phase and `riskTolerance` collected inside `fields`.

Target execution order: **classify → intake (conditional) → fields → risk → allocation → contribution → equity → buffer → extraction**

| Phase | Job | Input → Output |
|-------|-----|----------------|
| classify | Label the goal: `normal`, `out_of_scope`, or `unrealistic` (contradictory dropped) | `goal` → `GoalClassification` |
| intake | Redirect misclassified goals; reject if user declines; extract clean `redirectedGoal` on acceptance | `goal`, classification → `IntakeResult` |
| fields | Collect core profile fields via conversation | `goal` → `FieldsPhaseOutput` |
| risk | Elicit a 1–5 self-rating of comfort with temporary drops; map deterministically to `conservative`/`moderate`/`aggressive` | `goal`, `FieldsPhaseOutput` → `RiskPhaseOutput` |
| allocation | Size the total-portfolio equity/buffer split using multi-factor anchor (risk, timeline, age, emergency fund, debt) | `goal`, fields, risk → `AllocationPhaseOutput` |
| contribution | Establish one-time vs. periodic intent | `goal`, fields → `ContributionPhaseOutput` |
| equity | Resolve which equity instruments fill the equity bucket + within-equity split (classify-then-route) | `goal`, fields, risk, allocation, contribution → `EquityPhaseOutput` |
| buffer | Resolve which buffer instrument fills the buffer bucket | `goal`, fields, risk, allocation, equity → `BufferPhaseOutput` |
| extraction | Thin assembly into `UserProfile` (only remaining LLM call: goal summary) | all phase outputs → `UserProfile` |

Each phase runs a `runPhaseLoop` tool-call loop with its own system prompt, then a post-loop structured extraction call produces the phase's typed output. A `*.rules.md` file is co-located with each phase (and at the stage root) as the behavior spec that drives prompts and evals. Cross-phase primitives — schemas, constants, types, and shared helpers — live under `clarify/shared/`.

**Why allocation is its own phase:** Risk classification is only half the behavioral protection — sizing the equity bucket to tolerance is what makes the classification actionable. A conservative user at 40% equity experiences a 20% stock drop as an 8% total-portfolio drop, which is what protects against the panic-sell behavior they self-reported. Cramming this decision into the equity phase would recreate the "preferences phase bloat" the refactor is built to eliminate.

## Stage Boundary Validation

The clarify stage output is validated with `UserProfileSchema`. If the LLM produces output that fails validation, the pipeline stops immediately and sends an `error` event — no retry. A malformed output means the LLM fundamentally misunderstood the task, and retrying the same prompt is unlikely to help. The user starts a new session.

## OpenAI Failure Handling

All OpenAI API calls use retry with exponential backoff (3 attempts). If all retries fail, nothing is saved. The pipeline sends an `error` event and the user retries from scratch.

---

## Design Decisions

### Multi-phase split

Splitting by responsibility keeps each prompt short and focused, improving instruction-following. Each phase has its own system prompt scoped to a single job, runs its own `runPhaseLoop`, and returns a typed structured output consumed by the next phase. Phases are decoupled: they receive plain typed inputs from the orchestrator rather than accumulating conversation state across boundaries. Evals are more targeted — each phase is tested independently, assertions are tighter, and failures are easier to isolate to a specific phase.

(Historical note: the initial implementation chained phases via `previous_response_id` with a single extraction call at the end. The refactor in [`CLARIFY_REFACTOR_PLAN.md`](../CLARIFY_REFACTOR_PLAN.md) replaces that with the typed I/O pipeline described above.)

### Phase loop guardrails

`runPhaseLoop` enforces a max tool call count to guard against the model not converging, and `collectToolOutputs` rejects any tool that isn't `ask_user`. Both violations throw `InternalError`.

### Classifier + intake routing

Some goals require handling before field collection can begin: stock picking requests need an ETF redirect, and unrealistic return expectations need a reality check. Embedding this branching logic in the fields prompt would create a "mega prompt" where routing decisions compete with field-collection instructions, degrading adherence (frontier models follow ~150–200 instructions reliably; complex branching consumes that budget fast).

The solution: move routing into code. A lightweight classifier (`classifyGoal`) makes a single structured LLM call and returns one of three values — `normal`, `out_of_scope`, or `unrealistic`. Code then routes to the appropriate intake phase before field collection begins:

```
"Should I buy NVIDIA stock?"
  → classifyGoal()             → out_of_scope
  → handleOutOfScopeRedirect   → IntakeResult { accepted: true, redirectedGoal }
  → collectFields(redirectedGoal ?? goal)
  → collectRisk → collectAllocation → ... → extractUserProfile
```

Each intake phase (`runPhaseLoop`) handles its specific conversation. Acceptance is determined by regex-matching the model's terminal phrase — `/got it/i` → accepted, anything else → rejected. The intake prompts instruct the model to respond with exactly `"Got it."` (accepted) or `"Understood."` (rejected, visible to user), making the signal deterministic enough for regex. The result is typed as `IntakeResult`:
- `{ accepted: true, redirectedGoal }` — the intake handler extracts a clean goal string capturing the accepted ETF redirect; orchestrator passes `redirectedGoal ?? goal` to `collectFields`
- `{ accepted: false }` — end the session; the stage sends a per-classification closing message from `INTAKE_REJECTION_MESSAGES`

The fields prompt is left with one job: collect required profile fields.

(The earlier pipeline included a `contradictory` classification for goals with conflicting risk signals like "maximum returns but I can't lose money." This path has been dropped — the risk phase's 1–5 self-rating collapses any goal-stated contradiction into the user's own comfort score.)

### Handlers as sub-agents; code as orchestrator

The classifier (`classifyGoal`) and intake handlers (`handleOutOfScopeRedirect`, `handleUnrealisticExpectations`) each live in their own subfolder under `clarify/intake/` alongside their evals and run logs. Each handler is a sub-agent in the practical sense: its own system prompt, its own `runPhaseLoop` tool-call loop, and a typed result (`IntakeResult`). The clarify stage orchestrates them explicitly in code after the classifier runs.

An alternative considered: skip the classifier entirely and expose the handlers as LLM tools, letting a single top-level agent decide which to call (tool-as-router). This collapses classify + route into one inference. It breaks down here because the handlers are multi-turn conversations — the tool's "execution" would itself involve nested LLM calls and user interaction. The outer agent would just wait, contributing nothing, making it a very expensive classifier.

The pattern works when the routed actions are simple and single-shot. When the actions are themselves stateful conversations, explicit code routing after a lightweight classifier is the right call: cheaper, independently testable, and each piece is observable in isolation.

### Risk phase — single 1–5 self-rating

The risk phase asks one question: a 1–5 self-rating of the user's comfort with seeing investments drop temporarily, with concrete behavioral anchors at 1 ("very uncomfortable — I'd want to sell immediately"), 3 ("neutral — I'd be uneasy but try to hold"), and 5 ("completely comfortable — I'd see it as a buying opportunity"). The integer is mapped deterministically in code: 1–2 → `conservative`, 3 → `moderate`, 4–5 → `aggressive`. The post-loop extraction call returns only `selfRatingScore`; `riskTolerance` is computed in TypeScript, not produced by an LLM.

**Why direct self-rating, not hypothetical drop scenarios.** Risk-tolerance research (Statman, Kitces, CFA Institute *Psychometric Review*) shows direct self-rating items have higher predictive validity than hypothetical scenario questions, and historical-recovery framing ("markets recovered from 2008 and 2020") is a documented priming bias specific to risk-tolerance questionnaires. An earlier two-turn A/B drop-scenario design also exhibited an intermittent prompt-adherence flake (~1 in 3–4 runs); the single-turn shape removes the multi-step flow entirely, so the flake disappears structurally. Full sources, trade-offs, and rejected alternatives (including a pension-past-behavior probe) live in [`clarify.risk.research-notes.md`](../src/server/pipeline/stages/clarify/risk/clarify.risk.research-notes.md).

**Default-on-unresolved is conservative, not moderate.** If the user gives an out-of-range or non-mappable answer twice (after one re-ask), the extraction defaults to `selfRatingScore: 1` → `conservative`. Under-sizing equity is recoverable; oversizing toward intolerance triggers exactly the panic-sell behavior the phase is meant to detect. The safer default does the right thing under uncertainty.

**`selfRatingScore` is preserved on the output** so the allocation phase (Phase 4b) can calibrate within a bucket if needed (e.g., distinguishing a "5" aggressive from a "4" aggressive). Mapping inside risk stays coarse on purpose — instrument granularity belongs to allocation, not classification.

### Edge case — mid-conversation contradiction

If a user states a `normal` goal but expresses contradictory risk wording during the risk phase (e.g., "I'd sell immediately but I also want aggressive growth"), this can't be pre-classified. The 1–5 self-rating collapses the contradiction into a single number — the user picks one point on the scale, and that's the signal. Strong wording at extremes ("absolutely not" → 1, "buying opportunity" → 5) is mapped during extraction. The allocation phase (Phase 4b) further protects against any residual mismatch by sizing the equity bucket to the resulting risk tolerance — so panic-sell behavior is contained regardless of how the goal was initially phrased.

### `plansToContribute: boolean` instead of `monthlyContribution: number`

Users contribute on irregular schedules (every 2–3 months, every 6 months, etc.), and capturing a fixed monthly number creates a false precision problem: the number is hard to collect accurately and downstream predictions based on it would likely be wrong or misleading. A boolean is sufficient for the downstream use case — adjusting plan examples and projections for "contributes periodically" vs. "one-time investment." If a specific amount ever becomes necessary, it belongs in a later, dedicated phase.

### Fields phase takes `goal: string` directly

The intake handlers are short redirections; their LLM conversation context adds little value to the fields phase. Instead, a later refactor phase will build an enriched goal string that incorporates any relevant intake context explicitly and passes it to fields as a clean typed input. This is simpler and more testable than threading a `previous_response_id` through two unrelated phases.
