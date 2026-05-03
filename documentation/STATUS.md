# Project Status

## Task Queue

| # | Task |
|---|------|
| T3 | EF/debt gate |
| T3.5 | Drop `age`, rename `fields` → `parameters` |
| T3.6 | Align `IntakePhaseOutput` to `{ status: "accepted" \| "rejected" }` pattern |
| T4 | Equity |
| T5 | Buffer |
| T6 | Wire equity/buffer in orchestrator |

## Task Notes

### T3.5 — Drop `age`, rename `fields` → `parameters`

**Summary:** After T3 removes EF/debt, the fields phase is left collecting `amount`, `age`, and `timeline`. `age` was never used in any decision logic — the allocation model is keyed on `timeline × riskTolerance` only, and the risk phase prompt explicitly guards against using age to suggest a score. The research notes confirm age was consciously dropped from the 5-factor design ("TDF glidepaths use years-to-retirement, not age"). With only `amount` and `timeline` remaining, `fields` is too generic a name — rename to `parameters`, which reflects that these are the two input parameters that drive everything downstream.

**Why now (after T3):** T3 leaves the phase in a transitional state. This task completes the cleanup with a clean boundary.

**Blast radius (to assess when planning):** schema, types, phase file + directory rename, prompt + extraction instructions, rules file, eval file, runs/last-run files, all downstream context strings that pass `fields.age`, imports across the pipeline.

## EF/Debt Refactor Watch Items (check after evals)

- **Mixed message + Option B.** Current design (Option A): when user both answers and asks a question (e.g. "Yes, but does a savings account count?"), `answer` is set to null, the question is answered, and the answer is re-confirmed on the next turn. If evals show this breaks or causes too many retries, consider Option B: allow `answer` to be non-null when `clarificationNeeded: true` so the orchestrator can use the answer immediately without an extra round-trip. Trade-off: breaks the clean discriminated contract, adds orchestrator complexity.

- **Retries bump to 3.** Default is 2. A mixed message followed by two clarifying questions in a row needs 4 attempts total — retries=2 exhausts before resolving. If evals surface this scenario failing, bump `ASK_WITH_CLASSIFY_DEFAULT_RETRIES` to 3.

## Improvements

- **Allocation budget exhaustion — typed error + graceful user message.** When `runPhaseLoop()` exhausts `MAX_ALLOCATION_TOOL_CALLS`, a generic `InternalError` propagates and the user gets a cold error event. Fix has two parts: (1) catch `InternalError` in `collectAllocation` and re-throw as a typed `AllocationConflictError` ("budget exhausted without agreed split"); (2) handle `AllocationConflictError` in the orchestrator to send a graceful closing message (e.g., "We weren't able to settle on an allocation — let's start fresh") instead of the generic error event. Before implementing, check how the orchestrator currently catches and dispatches errors to confirm distinct handling is wired or needs to be added.

- **`print_to_user` tool (fire-and-forget).** Add a second tool alongside `ask_user` for sending a terminal message without waiting for a user response. Fixes the class of bugs where a phase sends a closing acknowledgment via `ask_user` and inadvertently waits for input. Requires changes to `ask-user.tool.ts`, `clarify.lib.ts` (`collectToolOutputs` currently rejects non-`ask_user` tools), and all phase prompts + evals that send terminal messages.
