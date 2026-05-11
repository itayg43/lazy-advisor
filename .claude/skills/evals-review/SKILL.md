---
name: evals-review
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

### 3. Read last-run, rules, and implementation files

Only proceed to this step after step 2 has fully completed — do not read last-run files in parallel with the eval run.

Read all matched `*.last-run.md` and `*.rules.md` files in parallel. Also read the corresponding phase implementation file (the `*.ts` file co-located with the eval, e.g. `clarify.risk.ts`) for any phase where you expect to flag a rules-alignment finding. This is required to distinguish intentional prompted behavior from accidental divergence — you cannot make that call from last-run and rules alone.

### 4. Produce the quality report

Write a structured report covering the following dimensions. Use the last-run conversations as primary evidence — quote specific exchanges where they support a finding. Use the rules files as the benchmark — flag any divergence between stated rules and observed behavior.

---

#### Test Results

Pass/fail summary. For any failure: test name, what the agent said, what the expected outcome was, and the likely root cause (extraction bug, prompt gap, edge case not covered, etc.).

---

#### Per-phase analysis

For each phase that was run, assess:

- **Rules alignment** — Does the observed behavior match the rules file? Call out any rule that the conversation violates or only partially satisfies. Before reporting a divergence, verify against the implementation file — if the behavior is explicitly prompted, note the prompt/rules gap instead of flagging the behavior as wrong.
- **Prompt/rules sync** — Are there behaviors in the prompt that are not documented in the rules file? Flag any meaningful prompt behavior (handling patterns, tone instructions, edge-case logic) that has no corresponding rule. This is a documentation gap even if the behavior itself is correct.
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
- **Type**: Coverage gap / Quality issue / Prompt-rules sync gap
- **Confidence**: Verified (cross-checked against implementation file) / Inferred (from last-run and rules only — treat as a hypothesis, not a confirmed finding)
- **Finding**: what the issue is, with a quoted example if applicable
- **Suggested fix**: a concrete direction (prompt change, new eval case, extraction rule tweak, etc.)

---

#### Summary

2–3 sentences: overall health of the pipeline, what's working well, and the single most important thing to act on next.

---

### 5. Save the report

Write the full report produced in Step 4 to:

```
documentation/eval-reports/YYYY-MM-DD-HH-MM.md
```

Use the current date and time (UTC) for the filename (e.g., `2026-04-27-11-38.md`). If the `documentation/eval-reports/` directory does not exist, create it first.

Include this header at the top of the saved file, before the report body:

```
# Evals Quality Report — YYYY-MM-DD
> Commit: <current git commit hash> | Tests: X passed, Y failed
```
