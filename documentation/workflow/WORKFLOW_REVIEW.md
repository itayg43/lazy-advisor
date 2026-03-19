# Review: CAPABILITY-DECISION.md vs Dave Ebbelaar's Best Practices

Review of the lazy-advisor plan against Dave Ebbelaar's (Datalumina) methodology from his YouTube series on building AI agents.

## Where the plan aligns well

### Staged pipeline with structured handoffs
Maps directly to Dave's **Level 2 (Prompt Chains & Routing)** combined with **Level 3 (Tool-Calling Agent)**. He explicitly recommends this: deterministic code controls the flow, LLM operates within constrained tool sets per stage. The plan doesn't let the LLM decide to skip research or reorder stages — code does that. This is exactly his "mostly deterministic software with strategic LLM calls" philosophy.

### Context engineering
Nails his core principle: "smallest set of high-signal tokens." Each stage gets a focused prompt with minimal structured input. Raw search results are summarized in Stage 2 and discarded before Stage 3. Stage 4 iterations get current plan + profile + latest feedback, not full conversation history. This directly addresses his "context rot" / attention budget problem.

### Feedback classification with cheap model for routing
Maps to his Level 2 routing pattern. Classifier decides the path, full model does the work. He calls this out explicitly: code controls flow, not the model.

### Human-in-the-loop
The `ask_user` tool and Stage 4 iteration loop match his Building Block #7 (Feedback). The pattern is: generate → human reviews → approve/revise → loop.

### Validation at boundaries
Zod schemas at stage handoffs map to his Building Block #4 (Validation). He emphasizes that LLM output must be validated before it propagates.

### Tool design
Tools are self-contained and stage-scoped. Dave says: "If a human engineer can't definitively say which tool should be used, an AI agent can't be expected to do better." The tools are clear and non-overlapping per stage.

### Recovery patterns
Retry with backoff, incremental persistence, graceful degradation on search failure — these map to his Building Block #6 (Recovery).

## Where the plan diverged — and how we resolved it

### 1. Parts lean toward Level 4 complexity (Dave says: "Use the simplest level that gets the job done")

**Issue:** The plan had overlapping safety caps — 10 tool-call cap, 8 search cap, 5 iterate search cap, 5 iteration limit — solving problems that hadn't occurred yet. Stage boundary validation with hard-fail on schema errors was flagged as aggressive.

**Resolution:** Collapsed to **one reasonable cap per stage**. Zod validation **stays hard-fail** — if the LLM output doesn't match the schema, something is genuinely wrong and garbage should not propagate downstream. This is a deliberate contract, not an oversight.

### 2. "LLM calls are the most expensive and dangerous operation"

**Issue:** Could some feedback classification (e.g., "skip bonds" → `remove_step`) be handled deterministically instead of with an LLM call?

**Resolution:** Rejected deterministic routing. Natural language is too varied — "skip bonds", "actually don't bother with the bond stuff", "drop that part", "nah skip it" all mean the same thing. A regex/keyword approach either covers a handful of patterns and misses most real input, or grows into a maintenance headache. The cheap-model classifier is already the right trade-off: fast, cheap, handles real user input. Revisit only if classifier latency becomes a bottleneck.

### 3. Observability scope for MVP

**Issue:** 10+ Prometheus metrics from day one is a lot of instrumentation before the system is even running.

**Resolution:** MVP implements only **trivial metrics from existing middleware wrappers** — HTTP request counts, latency histograms, error rates, and OpenAI token usage/latency per stage. Pipeline-specific metrics (stage durations, feedback classification distribution, step operation patterns) are deferred and added incrementally as the system matures.

### 4. Memory building block

**Issue:** Dave's Building Block #2 (Memory) wasn't acknowledged in the plan, even though the user profile passed between stages already implements it.

**Resolution:** No design change needed — the plan already implements session memory correctly via the structured user profile. Cross-session memory is correctly deferred. Acknowledged in the decision doc.

## Summary

The plan is **strongly aligned** with Dave's methodology. The staged pipeline, context engineering, validation, feedback loop, and tool design all follow his patterns closely. The four divergence points have been resolved: caps simplified to one per stage, feedback classification stays LLM-based (cheap model), metrics scoped to what middleware provides for free, and session memory acknowledged as already implemented.
