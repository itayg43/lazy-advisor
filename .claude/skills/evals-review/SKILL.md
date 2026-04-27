---
name: evals-review
model: sonnet
effort: high
description: Run evals, read last-run files, and produce a full quality report — conversation tone, flow, edge-case coverage, and ranked improvement opportunities.
---

## Args

Optional: a phase name to scope the run (e.g., `risk`, `allocation`, `classify`, `contradictory`, `fields`, `contribution`, `out-of-scope`, `unrealistic`). If omitted, all phases are run and reviewed.

## Steps

### 1. Discover files

Run these three commands to discover all files dynamically:

```bash
find src/server/pipeline/stages/clarify -name "*.eval.ts" | sort
find src/server/pipeline/stages/clarify -name "*.last-run.md" | sort
find src/server/pipeline/stages/clarify -name "*.rules.md" | sort
```

If an arg was provided, filter all three lists to entries whose path contains the arg.

### 2. Run evals

- **All phases:** `npm run test:evals`
- **Scoped:** `npm run test:evals -- <arg>` (vitest treats it as a filename filter — matches any eval whose path contains the arg)

From the output, extract: total tests, pass count, fail count, and the full error message for any failure.

### 3. Read last-run and rules files

Read all matched `*.last-run.md` and `*.rules.md` files in parallel.

### 4. Produce the quality report

Write a structured report covering the following dimensions. Use the last-run conversations as primary evidence — quote specific exchanges where they support a finding. Use the rules files as the benchmark — flag any divergence between stated rules and observed behavior.

---

#### Test Results

Pass/fail summary. For any failure: test name, what the agent said, what the expected outcome was, and the likely root cause (extraction bug, prompt gap, edge case not covered, etc.).

---

#### Per-phase analysis

For each phase that was run, assess:

- **Rules alignment** — Does the observed behavior match the rules file? Call out any rule that the conversation violates or only partially satisfies.
- **Conversation quality** — Is the language natural, educational, and appropriately concise? Does the agent use concrete figures (e.g., actual ₪ amounts from the user's profile)? Does tone stay matter-of-fact without being cold or preachy?
- **Flow** — Turn efficiency (does it complete in the expected number of turns?), re-ask logic (are re-asks clean and non-repetitive?), deflections (are off-topic questions handled without derailing the phase?).
- **Edge-case handling** — How does it handle vague, invalid, or adversarial inputs? Are defaults reasonable?

---

#### Gaps and improvement opportunities

A ranked list of specific, actionable findings — things that could be improved even if all tests pass. Distinguish between:

- **Coverage gaps** — rules or behaviors that have no eval test case
- **Quality issues** — behaviors that are tested and pass but could be better

Each entry:

- **Priority**: Must fix / Should fix / Nice to have
- **Phase**: which phase
- **Type**: Coverage gap / Quality issue
- **Finding**: what the issue is, with a quoted example if applicable
- **Suggested fix**: a concrete direction (prompt change, new eval case, extraction rule tweak, etc.)

---

#### Summary

2–3 sentences: overall health of the pipeline, what's working well, and the single most important thing to act on next.
