# RPI Workflow Improvements

Analysis of gaps identified from "Everything We Got Wrong About Research-Plan-Implement" by Dexter Horthy.
Each section captures the video's principle, current state, and the outcome of our discussion.

---

## 1. Objective Research During Development

### What the video says
If the agent knows what it's building while researching, it gives opinions not facts. The fix: a fresh context window with no task knowledge explores the codebase objectively first, then task context is introduced for design decisions.

### Where we are now
When Claude researches the codebase it already knows the task — introducing bias toward confirming a pre-formed approach rather than surfacing objective facts about the current state.

The "read full file first" rule in CLAUDE.md partially addresses this, but there's no structural separation between exploration and design.

### Discussion / Decision
**Decision:** Before designing any implementation, spawn an Explore subagent to map the affected area with no task framing. Once findings are returned, bring in the task context and compare against the existing plan before designing.

The separation is real because subagents start fresh — they only see what's in their prompt, not the conversation history.

This rule is added to the "Before writing code" section of `CLAUDE.md`.

**Example:**

Wrong — task context leaks into exploration:
> "Explore the pipeline stages — we need to add a validation stage that checks the user profile before research"

Right — pure objective exploration:
> "Explore the pipeline stages — what exists, what patterns are used, how stages are structured and composed"

After findings are returned, Claude automatically introduces the task context:
> "Given the above findings, the task is X. Does the current plan in PLAN.md align with what we found, or does it need revisiting?"

---

## 2. Design Artifact Before Implementation

### What the video says
Before writing any code, the agent produces a ~200-line markdown "brain dump": its understanding of the task, the approach, and open questions. This creates a reviewable checkpoint and surfaces misalignment before it gets baked into code.

A second artifact — a structure outline (think C header file) — defines signatures, types, and order of changes. Lighter to review than a full implementation, and allows early re-steering.

### Where we are now
`CONVENTIONS.md` says to align on input types, return types, and error strategy before coding — but this is behavioral guidance, not a structural step. There's no required artifact, no checkpoint, and no shared format for what "alignment" looks like.

Silent design decisions get made during implementation rather than surfaced upfront.

### Discussion / Decision
_TBD — pending discussion_

**Note before discussing:** `CONVENTIONS.md` § Development Process has "Check reference implementations before starting to code" — this partially overlaps with the Explore rule from Gap 1 and may need reconciliation. Revisit when Gap 2 decision is made.

---

## 3. Vertical Slices in Task Planning

### What the video says
Models naturally plan horizontally — all DB work, then all service work, then the API. This pushes the first testable checkpoint to the very end, making failures expensive to debug.

Vertical slices force one thin end-to-end thread first (e.g., mock endpoint → wire the caller → add persistence), so there's an early validation point before the full feature is built out.

### Where we are now
Tasks in `PLAN.md` tend to be scoped horizontally — schema, then service, then repository, then tests — for a whole feature at once. The first real checkpoint is often after everything is wired together.

### Discussion / Decision
_TBD_
