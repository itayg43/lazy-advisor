# Allocation Phase — Open Findings

Scope: the allocation phase (`clarify.allocation.*`), its `runConversation` runner,
the stage/orchestrator wrappers, and the eval/testing layer. Open and advisory
findings only; resolved items have been removed.

Date: 2026-07-12

---

## Status at a glance

Status legend: ⬜ open (committed work, still to do) · 🔵 advisory (watch/flag, no
committed action).

### Open — to work on later

| # | Finding | Type | Note |
|---|---------|------|------|
| 5 | LLM-as-judge makes eval nondeterministically failable | test stability | Needs a fail-vs-record decision |
| 6 | No e2e unresolved/errored *conversation* eval | coverage gap | Give-up paths only mock-covered |

### Advisory — flagged, no committed action

| # | Finding | Type | Note |
|---|---------|------|------|
| 2 | `hardStopTurns` required but purely defensive | coupling | Wants a helper/comment template before a 2nd caller |
| 9 | Patch→successor-state translation is allocation-only | reuse / watch | Extract a reducer only if T5/T6 repeat the shape |

---

## runConversation runner

**2. `hardStopTurns` is required but purely defensive** 🔵 — *coupling*
Good that every caller must state its ceiling — but the runner has *no* concept of the
real budget, so a caller that passes a wrong `hardStopTurns` (too low) converts a normal
long conversation into a spurious `InternalError` exit. It's coupled to the caller's
turn-accounting by a hand-verified `+1`. For a second caller (equity/buffer) this
coupling has to be re-derived. Not a bug, but the kind of invariant that wants a helper
or comment template so it isn't re-reasoned per phase.

**9. Patch→successor-state translation is allocation-only** 🔵 — *reuse / watch*
`createTurnHandler` speaks two vocabularies — the internal `AllocationPromptDecision` (partial
`negotiationStatePatch`) and the runner's full-state `Prompt` — and assembles one from the other in a
single place. Clean and correct (the runner knows nothing about patches; counters commit centrally),
but bespoke to allocation. If T5/T6 reproduce the same "decision + patch → assemble successor state"
shape, that's a reducer worth lifting to the runConversation layer. Per the no-speculative-abstractions
rule: watch for it at T5, extract only once the second phase shows the same shape — don't build it now.

---

## Eval, testing & judge

**5. The LLM-as-judge makes the eval nondeterministically failable** ⬜ — *test stability*
`judgeAllocationConversation` runs `gpt-5.4` at medium effort and *fails the eval* on a
subjective verdict. Gated to `test:evals` (never CI) and acknowledged as a pilot, but a
subjective grader in the pass/fail path means green depends on a model's judgment on
borderline prose. Consider whether judge verdicts should *fail* the eval or merely be
*recorded* to the last-run artifact for human review. As-is, prose regressions and judge
flakiness are indistinguishable.
**Observed instance (2026-07-13):** on the full-file run validating the classifier-eval
tweak, the judge failed `should answer a clarifying question then return to the anchor
proposal` on `answer-scoping` + `conciseness` — the question composer appended
"(Recommended range: 80–90% equity.)" to a buffer concept answer, which the concept bullet
discourages. Borderline: either a real prompt-adherence slip or judge oversensitivity, and
per this finding a single run can't distinguish them. All 26 non-judge assertions (incl. the
new percent check) passed. Left unfixed pending the fail-vs-record decision above; flagged
here for future check.

**6. No eval exercises the unresolved/errored *conversation* end-to-end** ⬜ — *coverage gap*
Unit tests drive budget exhaustion with mocked classifications, and the orchestrator test
mocks the whole phase — but no real-model eval walks a user actually failing to converge
(endless counters or questions) to confirm graceful exit with real classifier output.
The give-up paths are only mock-covered. Given the budgets are the phase's main safety
mechanism, one real-model exhaustion eval would be worth its cost.

