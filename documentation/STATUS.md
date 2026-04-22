# Project Status

## Up Next

**T1 — Fields timeline → 4-bucket enum** — See [Refactor Plan § T1](../CLARIFY_REFACTOR_PLAN.md#t1--fields-timeline--4-bucket-enum).

## Task Queue

| # | Task |
|---|------|
| T1 | Fields timeline → 4-bucket enum |
| T2 | Intake cleanup |
| T3 | EF/debt gate |
| T4 | Phase 5a — equity |
| T5 | Phase 5b — buffer |
| T6 | Wire equity/buffer in orchestrator |

Full specs: [CLARIFY_REFACTOR_PLAN.md](../CLARIFY_REFACTOR_PLAN.md)

## Improvements

- **`print_to_user` tool (fire-and-forget).** Add a second tool alongside `ask_user` for sending a terminal message without waiting for a user response. Fixes the class of bugs where a phase sends a closing acknowledgment via `ask_user` and inadvertently waits for input. Requires changes to `ask-user.tool.ts`, `clarify.lib.ts` (`collectToolOutputs` currently rejects non-`ask_user` tools), and all phase prompts + evals that send terminal messages.
- **Allocation rules: budget-exhausted fallback description is wrong.** `clarify.allocation.rules.md` § "Extraction fallback" says exhausting `MAX_ALLOCATION_TOOL_CALLS` returns the last-discussed split. `ARCHITECTURE.md` (Phase loop guardrails) says budget violations throw `InternalError` — which is what `runPhaseLoop()` actually does. The rules are describing behavior that doesn't exist. Action: delete the fallback paragraph from the rules, replace with a note matching the actual throw behavior, then decide if a test for throw-on-budget-exhaust is worthwhile.
