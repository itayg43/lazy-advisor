# Project Status

## Up Next

**Fields timeline → 4-bucket enum** — Replace `timeline: string` with a presented-choice enum (`"under 3 years" | "3–5 years" | "5–10 years" | "10+ years"`) that maps 1:1 to the allocation anchor table. Touches: fields prompt, allocation prompt, `FieldsPhaseOutputSchema`.

## Phase queue

| Phase | Task | Notes |
|-------|------|-------|
| 5a | Equity (classify-then-route) | Consumes `AllocationPhaseOutput` |
| 5b | Buffer | Depends on 5a. Adds `equity: EquityAllocation[]` + `buffer: string` to `UserProfile` |
| 7 | Intake cleanup | Update out-of-scope and unrealistic prompts; add `redirectedGoal` extraction post-acceptance (Phase 7d). Parallelizable with 5a/5b |
| 9 | Eval alignment pass | — |
| 10 | Rules files for classify + intake | — |

**Strict chain:** 5a → 5b. Allocation output feeds both equity and buffer as grounding context.

## Improvements

- **EF / debt as stage-level suitability gate.** `hasEmergencyFund` and `hasDebt` are collected but not consumed downstream. Correct position: a stage-level gate before field collection, modeled on the intake rejection pattern. Decide during Phase 7.
- **Allocation shekel math → code.** Pre-compute equity/buffer shekel amounts in TypeScript and pass as grounding, removing model arithmetic. Not urgent — current prompt discipline holds.
- **`print_to_user` tool (fire-and-forget).** Add a second tool alongside `ask_user` for sending a terminal message without waiting for a user response. Fixes the class of bugs where a phase sends a closing acknowledgment (e.g., Rule 3 vague-answer in contribution) via `ask_user` and inadvertently waits for input. Requires changes to `ask-user.tool.ts`, `clarify.lib.ts` (`collectToolOutputs` currently rejects non-`ask_user` tools), and all phase prompts + evals that send terminal messages.
