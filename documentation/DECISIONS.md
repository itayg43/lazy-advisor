# Design Decisions

Non-obvious architectural and design choices. When completing a plan section, migrate its Design Decisions block here before deleting the section file.

---

## Section 3 — Clarify Stage

**Three-phase split (fields → preferences → extraction)** — splitting by responsibility keeps each prompt short and focused, improving instruction-following. Each phase has its own system prompt scoped to a single job; conversation context accumulates naturally via `previous_response_id` chaining so each phase sees exactly the history it needs. Evals are more targeted — each phase is tested independently, assertions are tighter, and failures are easier to isolate to a specific phase.

**Phase loop guardrails** — `runPhaseLoop` enforces a max tool call count to guard against the model not converging, and `collectToolOutputs` rejects any tool that isn't `ask_user`. Both violations throw `InternalError`.
