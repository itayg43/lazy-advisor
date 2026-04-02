# Eval Improvements — Clarify Stage

Planned improvements to clarify stage evals and the usage stories document (`documentation/workflow/WORKFLOW_EXAMPLES.md`). This work should be done on the `fix/clarify-prompt-alignment` branch after the prompt optimization changes are merged.

## Eval Gaps

### 1. Out-of-scope redirect (Story 5)

The clarify prompt has rules for redirecting out-of-scope requests (day trading, crypto, stock picking) toward ETF-based passive investing. No eval validates this behavior.

**Type:** Full-loop eval
**Input goal:** `"Should I buy NVIDIA stock?"` or `"I want to day trade crypto"`
**Expected behavior:** Model redirects toward ETF-based investing, then collects profile as normal.
**Assertions:** Schema validation passes, goal references ETFs or passive investing (not individual stocks/crypto).

### 2. Stop probing after 2 asks (Story 7 variant)

The prompt says: if a user has been asked about the same field twice without providing a specific value, accept the best available and move on. No eval covers this.

**Type:** Full-loop eval
**Scripted responder:** Give vague timeline twice (e.g., "long-term", then "I don't know, just long-term"), provide all other fields.
**Expected behavior:** Model stops probing timeline after 2 asks, proceeds to extraction.
**Assertions:** Schema validation passes, profile is complete (timeline may be vague — that's acceptable).

### 3. Non-Israel user (geographic diversity)

All current evals use Israel-based users. The schema supports any location.

**Type:** Extraction-only eval
**Transcript:** US-based user with USD amounts, Fidelity brokerage, 401k references.
**Assertions:** Location contains "US" or "United States", brokerage contains "Fidelity", amounts extracted correctly without currency confusion.

## Usage Stories Review

The usage stories in `WORKFLOW_EXAMPLES.md` should be reviewed for alignment with the current prompt behavior. Specific areas to check:

### Goal enrichment

Stories 1-3 show the full pipeline output, including how the agent presents information. The clarify stage's extraction now enriches goals from the entire conversation (not just initial input). Verify the example dialogues are consistent with this — the goals shown in plan outputs should reflect enriched context, not bare initial input.

### Field specificity rules

Story 1 shows the agent accepting "long-term" initially and asking for clarification — this is correct. Verify no other stories show the agent accepting vague values that the prompt now explicitly rejects (e.g., "eventually", "a while").

### Stop probing behavior

Story 7 shows progressive simplification for vague users. Verify the example aligns with the "2 asks then move on" rule — the agent shouldn't ask about the same field more than twice.

### Out-of-scope handling

Story 5 (stock picking) shows the agent declining and offering an ETF alternative. Verify the tone matches the current prompt's "redirect" instruction (not refuse — redirect).
