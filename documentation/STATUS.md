# Project Status

## Up Next

**T1 — Fields timeline → 4-bucket enum** — See [Refactor Plan § T1](../CLARIFY_REFACTOR_PLAN.md#t1--fields-timeline--4-bucket-enum).

## Task Queue

| # | Task |
|---|------|
| T1 | Fields timeline → 4-bucket enum |
| T2 | Intake cleanup |
| T3 | EF/debt gate |
| T4 | Equity |
| T5 | Buffer |
| T6 | Wire equity/buffer in orchestrator |

Full specs: [CLARIFY_REFACTOR_PLAN.md](../CLARIFY_REFACTOR_PLAN.md)

## Improvements

- **Allocation budget exhaustion — typed error + graceful user message.** When `runPhaseLoop()` exhausts `MAX_ALLOCATION_TOOL_CALLS`, a generic `InternalError` propagates and the user gets a cold error event. Fix has two parts: (1) catch `InternalError` in `collectAllocation` and re-throw as a typed `AllocationConflictError` ("budget exhausted without agreed split"); (2) handle `AllocationConflictError` in the orchestrator to send a graceful closing message (e.g., "We weren't able to settle on an allocation — let's start fresh") instead of the generic error event. Before implementing, check how the orchestrator currently catches and dispatches errors to confirm distinct handling is wired or needs to be added.

- **`print_to_user` tool (fire-and-forget).** Add a second tool alongside `ask_user` for sending a terminal message without waiting for a user response. Fixes the class of bugs where a phase sends a closing acknowledgment via `ask_user` and inadvertently waits for input. Requires changes to `ask-user.tool.ts`, `clarify.lib.ts` (`collectToolOutputs` currently rejects non-`ask_user` tools), and all phase prompts + evals that send terminal messages.
