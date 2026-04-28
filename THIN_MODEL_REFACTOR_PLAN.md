# Plan: Thin Model, Thick Orchestrator Refactor

## Context

The current `runPhaseLoop` pattern puts conversation state tracking, branching logic, and response generation into a single LLM call with a complex prompt. The EF/debt phase made this cost visible: simple conditional logic (ask two questions, educate if needed) required 5+ prompt iterations to get reliable behavior from a nano model at low effort. The root cause is not prompt quality — it's that LLMs are unreliable interpreters of multi-step decision trees but excellent at single, narrow tasks.

The fix is to invert control: **code drives the conversation flow; LLM calls are narrow and focused** — classify a single response, generate one message, extract one value. This is the pattern behind production agent systems (Claude Code, Codex, etc.).

---

## New Utility: `askWithClassify`

Add to `src/server/pipeline/stages/clarify/shared/clarify.lib.ts`.

### Key design decisions

**Stateless LLM calls.** Each classification call receives only the question + user response — no `previous_response_id`, no conversation history. This is the fundamental difference from `runPhaseLoop`. Minimal context per call = cheaper, faster, more reliable.

**Code owns the loop.** The utility handles one question: ask → wait → classify → optionally clarify and retry. The orchestrator sequences multiple calls.

### Schema contract

The caller-provided schema must include three fields alongside any extracted value:

```typescript
// Required shape for any schema passed to askWithClassify
{
  isClarifyingQuestion: boolean,  // true if user asked a question rather than answering
  clarification: string | null,   // what to say back if isClarifyingQuestion is true
  // ...plus whatever value field(s) the caller needs (e.g. answer, amount, score)
}
```

Example for yes/no questions (defined in `clarify.ef-debt.ts`, not in lib):

```typescript
const YesNoSchema = z.object({
  isClarifyingQuestion: z.boolean(),
  clarification: z.string().nullable(),
  answer: z.enum(["yes", "no"]).nullable(), // null if isClarifyingQuestion is true
});
type YesNo = z.infer<typeof YesNoSchema>;
```

### Signature

```typescript
type AskWithClassifyParams<TSchema extends z.ZodTypeAny> = {
  question: string;
  classifyInstructions: string;
  schema: TSchema;
  getValue: (output: z.infer<TSchema>) => z.infer<TSchema>[keyof z.infer<TSchema>] | null;
  sendToUser: SendToUser;
  waitForResponse: WaitForResponse;
  model: ResponsesModel;
  effort: ReasoningEffort;
  maxRetries?: number;        // default: 1
  defaultValue?: unknown;     // returned after exhausting retries; null if omitted
};

export const askWithClassify = async <TSchema extends z.ZodTypeAny>(
  params: AskWithClassifyParams<TSchema>,
): Promise<z.infer<TSchema>[keyof z.infer<TSchema>] | null>
```

> **Simpler in practice:** phase files will use a thin typed wrapper (e.g. `askYesNo`) rather than calling `askWithClassify` directly with generics.

### Internal flow (per call)

```
for attempt 0..maxRetries:
  sendToUser(question)
  userResponse = await waitForResponse()

  output = callOpenAIParsed({
    model, effort,
    instructions: classifyInstructions,
    input: [{ role: "user", content: userResponse }],
    // NO previous_response_id — fresh context each call
    text: { format: zodTextFormat(schema, "output") },
  })

  if !output.isClarifyingQuestion:
    return getValue(output)   // extracted value

  if output.clarification:
    sendToUser(output.clarification)
    // loop continues — question is re-asked at top of loop

return defaultValue ?? null
```

### Logging

Log at the same granularity as `runPhaseLoop`:
- Before each attempt: question being asked
- After classification: `isClarifyingQuestion`, extracted value (or null), token usage
- On exhausted retries: warn + log default applied

---

## EF/Debt Rewrite (`clarify.ef-debt.ts`)

### Constants (new, in `clarify.constants.ts`)

```typescript
export const EF_QUESTION =
  "Do you have an emergency fund (3–6 months of living expenses set aside in a liquid account)?";

export const DEBT_QUESTION =
  "Do you have any significant high-interest debt, such as credit card balances or personal loans? (A mortgage doesn't count here.)";

export const EF_EDUCATION =
  "An unexpected expense could force you to sell investments at a bad time — possibly at a loss. Standard guidance is 3–6 months of expenses in a liquid account before investing.";

export const DEBT_EDUCATION =
  "High-interest debt (e.g., credit cards at 15–25% APR) typically costs more than ETF investing earns (~7–10% per year). Paying it off first often yields a better net return.";

export const PROCEED_QUESTION =
  "\n\nWould you like to continue with your investment plan anyway?";
```

`MAX_EF_DEBT_TOOL_CALLS` is removed — no longer needed.

### Classification instructions (defined in `clarify.ef-debt.ts`, not in constants)

```typescript
const EF_CLASSIFY_INSTRUCTIONS = `
You are classifying a user's response to this question:
"${EF_QUESTION}"

Rules:
- answer "yes": user confirmed they have an emergency fund
- answer "no": user confirmed they do not have an emergency fund
- isClarifyingQuestion true: user asked a question instead of answering (e.g. "what counts as one?", "does a savings account qualify?")
- If isClarifyingQuestion is true, populate clarification: explain in 1–2 sentences that an emergency fund is 3–6 months of living expenses in a liquid account, then re-state the question.
- answer null when isClarifyingQuestion is true.
`;

const DEBT_CLASSIFY_INSTRUCTIONS = `
You are classifying a user's response to this question:
"${DEBT_QUESTION}"

Rules:
- answer "yes": user confirmed they have significant high-interest debt
- answer "no": user confirmed they do not (including if their only debt is a mortgage)
- isClarifyingQuestion true: user asked a question instead of answering (e.g. "does my mortgage count?", "what counts as high-interest?")
- If isClarifyingQuestion is true, populate clarification:
  - For mortgage: explain that a mortgage is secured, long-term debt at low rates and does not count here.
  - For other clarifying questions: explain that high-interest debt means unsecured debt like credit cards or personal loans at 15%+ APR.
  Then re-state the question.
- answer null when isClarifyingQuestion is true.
`;
```

### Orchestrator (`collectEfDebt`)

```typescript
export const collectEfDebt = async (sendToUser, waitForResponse): Promise<void> => {
  const hasEF = await askYesNo({
    question: EF_QUESTION,
    classifyInstructions: EF_CLASSIFY_INSTRUCTIONS,
    sendToUser, waitForResponse,
    defaultValue: true,  // if still unclear after retry: assume yes — don't block investment
  });

  const hasDebt = await askYesNo({
    question: DEBT_QUESTION,
    classifyInstructions: DEBT_CLASSIFY_INSTRUCTIONS,
    sendToUser, waitForResponse,
    defaultValue: false, // if still unclear after retry: assume no — don't block investment
  });

  if (hasEF && !hasDebt) return;

  const education = [
    !hasEF ? EF_EDUCATION : null,
    hasDebt ? DEBT_EDUCATION : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  sendToUser(education + PROCEED_QUESTION);
  await waitForResponse();
};
```

`askYesNo` is a thin typed wrapper around `askWithClassify` — same file, not exported.

### What disappears

- `runPhaseLoop` call in this phase
- `MAX_EF_DEBT_TOOL_CALLS` constant
- The 90-line prompt with its 5-step decision tree and 4 examples
- The `ask_user` tool dependency for this phase (tool still exists for other phases)

---

## Generalization Path (future tasks)

| Phase | Pattern | Notes |
|-------|---------|-------|
| EF/debt | `askWithClassify` (yes/no × 2) | **This task** |
| Fields | `askWithClassify` (integer + timeline enum) | Two sequential calls; early-exit for amount stays in code |
| Risk | `askWithClassify` (1–5 integer) | Default to 1 if still unclear |
| Contribution | `askWithClassify` (yes/no) | Simplest case |
| Allocation | Keep `runPhaseLoop` | Negotiation is inherently conversational |

`runPhaseLoop` and `runPhaseExtraction` stay for allocation and any phase that needs multi-turn conversation with full history.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/server/pipeline/stages/clarify/shared/clarify.lib.ts` | Add `askWithClassify` |
| `src/server/pipeline/stages/clarify/ef-debt/clarify.ef-debt.ts` | Full rewrite — remove `runPhaseLoop`, use `askWithClassify` |
| `src/server/pipeline/stages/clarify/shared/clarify.constants.ts` | Remove `MAX_EF_DEBT_TOOL_CALLS`; add EF/debt question + education + proceed strings |

---

## Verification

1. `npm run test:evals -- src/.../clarify.ef-debt.eval.ts` — all 8 tests must pass
2. `npm run type-check` — no type errors; `askWithClassify` must be fully typed
3. `npm test` — no regressions in unit tests
