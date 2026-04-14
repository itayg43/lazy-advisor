# Design Decisions

Non-obvious architectural and design choices. When completing a plan section, migrate its Design Decisions block here before deleting the section file.

---

## Section 3 — Clarify Stage

**Three-phase split (fields → preferences → extraction)** — splitting by responsibility keeps each prompt short and focused, improving instruction-following. Each phase has its own system prompt scoped to a single job; conversation context accumulates naturally via `previous_response_id` chaining so each phase sees exactly the history it needs. Evals are more targeted — each phase is tested independently, assertions are tighter, and failures are easier to isolate to a specific phase.

**Phase loop guardrails** — `runPhaseLoop` enforces a max tool call count to guard against the model not converging, and `collectToolOutputs` rejects any tool that isn't `ask_user`. Both violations throw `InternalError`.

**Classifier + intake routing** — Some goals require handling before field collection can begin: stock picking requests need an ETF redirect, unrealistic return expectations need a reality check, and explicit contradictions ("maximum returns but I can't lose money") need resolution. Embedding this branching logic in the fields prompt would create a "mega prompt" where routing decisions compete with field-collection instructions, degrading adherence (frontier models follow ~150–200 instructions reliably; complex branching consumes that budget fast).

The solution: move routing into code. A lightweight classifier (`classifyGoal`) makes a single structured LLM call and returns one of four values — `normal`, `out_of_scope`, `unrealistic`, or `contradictory` (defined in `GoalClassification`). Code then routes to the appropriate intake phase before field collection begins:

```
"Should I buy NVIDIA stock?"
  → classifyGoal()          → out_of_scope
  → handleOutOfScopeRedirect → IntakeResult { accepted: true, responseId }
  → collectFields({ previous_response_id })
  → collectPreferences → extractUserProfile
```

Each intake phase (`runPhaseLoop`) handles its specific conversation, then a follow-up `extractAcceptance` call (same pattern as `extractUserProfile`) determines the outcome. The result is typed as `IntakeResult`:
- `{ accepted: true, responseId }` — chain the response ID into the fields phase
- `{ accepted: false }` — end the session, send a closing message to the user

The fields prompt is left with one job: collect required profile fields.

**Edge case — mid-conversation contradiction:** If a user starts with a `normal` goal but gives contradictory risk signals while answering the risk question (e.g., "I'd sell immediately but I also want aggressive growth"), this can't be pre-classified. It's handled inline in the `riskTolerance` field definition in the fields prompt — not as a Decision Logic step.
