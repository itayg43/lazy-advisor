# T4 — `runConversation` design discussion

Joint design artifact for T4 ("Allocation refactor — move state from prompt to code"). Covers the new general-purpose multi-turn primitive that will power allocation (T4), equity (T5), and buffer (T6).

---

## Background

**Problem.** The current allocation phase encodes its branching state-tracking (1st vs Nth counter, 40-pp extreme threshold, framing-delivery flag) in the LLM prompt. The model handles this unreliably at `effort: "low"`, producing customer-facing inconsistencies.

**Principle (from Research-Plan-Implement notebook, confirmed in this session).**
> "Don't use prompts for control flow if you can use control flow for control flow. The if statement is really really powerful and LMs are really good at classifying things."

Practical translation: code owns deterministic flow, code owns state, and the LLM is invoked only for what code cannot solve (classification of free-text input + free-text generation).

---

## Scope

- `runConversation` is a **new** primitive — does not replace `runPhaseLoop`.
- Used by: **allocation** (T4), **equity** (T5), **buffer** (T6).
- `askWithClassify` stays as-is — different conversation shape (single-question Q&A with clarification loop). The two primitives coexist.
- `runPhaseLoop` stays for now — intake still depends on it. Retirement is a separate cleanup later, not part of T4.
- `runPhaseExtraction` **goes away** for `runConversation`-based phases — typed pieces accumulate in closure-owned state during the conversation, so no second extraction LLM call is needed.

---

## Decisions

### Architecture B — `history` exposed read-only to the phase

Two architectures considered:

- **A. Primitive owns LLM calls.** Phase emits directives like `{ type: "classify", schema, instructions }`; primitive runs the call with history-as-input internally. History stays hidden.
- **B. Phase owns LLM calls.** Primitive exposes `history` (read-only) to the handler. Phase calls `callOpenAIParsed` itself, composing whatever input it wants.

**Picked: B.** Reason: allocation has multi-call turns (e.g., a "question about drawdown" branch wants a classifier call followed by a micro-prompt response). Under A, the primitive's directive vocabulary would have to grow to cover sequenced calls. Under B, the primitive stays minimal forever; per-phase complexity stays per-phase.

### Closure-based state, no threading through the primitive

Initially sketched a state-threading shape where the handler returns `{ next, state }` and the primitive threads `state` between calls (with a generic `TState`).

**Rejected** as speculative complexity. The benefits (pure-function testability, snapshot/replay) were hypothetical — phases are tested end-to-end via evals, not by unit-testing handler functions with constructed states; there is no snapshot/replay use case.

**Picked:** state lives in the phase's closure as plain locals. Same pattern `askWithClassify` already uses internally. The primitive is generic only over `TResult`.

Closure-with-mutation maps to `&mut self` methods on a struct in Rust — same ownership model, different syntax.

### Two handlers — `initHandler` + `turnHandler` (no first-call sentinel)

Three approaches considered for "how does the phase know it's the first call (no user reply yet)":

- **A.** `reply: string | null`, null on first call; phase checks `if (reply === null)`.
- **B.** Discriminated-union argument `signal: { kind: "init" } | { kind: "reply"; text }`.
- **C.** Separate `initHandler` callback whose only job is to produce the opening directive; `turnHandler` always gets a non-null `userReply`.

**Picked: C.** The turn handler signature can't accidentally call `classifyIntent` with no input; each callback has one clear job. The cost (two handler types instead of one) is small.

### Result shape — `TResult` generic, phase handles `unresolved`

`runConversation` is generic only over `TResult` (the phase's payload on success). It throws `ConversationBudgetExhaustedError` if the turn budget is hit; the phase catches it and maps to its own `completed | unresolved` shape.

**Alternative considered:** the primitive itself returns a discriminated `{ status: "completed", ... } | { status: "exhausted" }`. **Rejected** — the per-phase boilerplate (one try/catch) is small, and pushing the discrimination into the primitive would force every consumer to handle exhaustion at the same level even when the right mapping is phase-specific.

### `ask_user` is no longer an LLM tool

Today, `runPhaseLoop` registers `ASK_USER_TOOL` and lets the model decide when to ask. Under the new pattern, **code decides** when to ask via the `Ask` directive. So all the tool plumbing goes away: no `getStageTools`, no `collectToolOutputs`, no `function_call`/`function_call_output` items, no threading via `previous_response_id`. The primitive just calls `responder.sendToUser` / `responder.waitForResponse` directly — same shape as `askWithClassify`.

The backlog `print_to_user` (fire-and-forget) item collapses into a future `Notify` directive kind — same `responder` interface, no separate tool. Not implemented yet; the loop's explicit `if (directive.kind === DirectiveKind.Ask)` branch makes adding a parallel `Notify` branch a localized addition rather than a refactor.

Future knowledge-base / data-lookup tools (e.g., for equity/buffer phases) remain a separate concern. Those are *internal LLM augmentation* (model decides to pull context mid-reasoning, user never sees it) — distinct from user-facing communication. They'd be passed to specific LLM calls inside `turnHandler`, not to `runConversation`. See § *T5/T6 knowledge access — agentic RAG* below.

### Use `EasyInputMessage` from the OpenAI SDK directly

Match `askWithClassify`. No local alias — direct SDK type. Consistency across the two primitives is worth more than an aspirational seam.

### `previous_response_id` is not used

Each LLM call is a pure function of `(instructions, input)` composed by the phase. No reliance on OpenAI's server-side response chain. Inline history is the input; reasoning state doesn't carry between turns (acceptable at `effort: "low"`).

---

## Types

```ts
export const DirectiveKind = {
  Ask: "ask",
  Done: "done",
} as const;

export type DirectiveKind = (typeof DirectiveKind)[keyof typeof DirectiveKind];

// What a handler tells the primitive to do next.
// - Ask: send `message`, await user reply, then call `turnHandler` again.
// - Done: stop the loop and return `result` from runConversation.
export type Directive<TResult> =
  | { kind: typeof DirectiveKind.Ask; message: string }
  | { kind: typeof DirectiveKind.Done; result: TResult };

// Called once before any user input. Produces the conversation's first directive.
// Split from TurnHandler so the turn signature doesn't have to model "no reply yet".
export type InitHandler<TResult> = () => Promise<Directive<TResult>>;

// Called after each user reply. `history` is read-only on purpose: handler-owned
// state (counters, flags, etc.) belongs in the handler's closure, not in history.
export type TurnHandler<TResult> = (
  history: ReadonlyArray<EasyInputMessage>,
  userReply: string,
  turnsUsed: number,
) => Promise<Directive<TResult>>;

export type RunConversationParams<TResult> = {
  initHandler: InitHandler<TResult>;
  turnHandler: TurnHandler<TResult>;
  /**
   * Maximum number of `turnHandler` invocations before the conversation is
   * declared exhausted. The handler may be called at most `budget` times;
   * the (budget+1)-th user reply causes `ConversationBudgetExhaustedError`
   * to be thrown before that reply is processed by the handler.
   *
   * Note: the (budget+1)-th reply is still consumed (pushed to history) before
   * the throw — phases should not rely on `history.length` to detect exhaustion.
   */
  budget: number;
  responder: Responder;
};
```

Why `typeof DirectiveKind.Ask` instead of inline `"ask"` literals: keeps `DirectiveKind` (the const) as the single source of truth — the type can't drift from the value if either is renamed — while still pinning each variant to a *specific* literal so discriminated-union narrowing keeps working in `switch`/`if` checks.

### Naming notes

- **Discriminant `kind`** (not `status` or `type`) — avoids overload with the phase-result `status` field.
- **Variant fields: `message` for `Ask`, `result` for `Done`.** `message` is neutral so it transfers cleanly to a future `Notify` variant without renaming.
- **`initHandler` / `turnHandler`** — fields and types share roots. **`userReply`** disambiguates from `Directive.message`. Local **`directive`** (not `next`) names the value by what it is, not by control-flow position.

---

## The primitive

```ts
export const runConversation = async <TResult>({
  initHandler,
  turnHandler,
  budget,
  responder,
}: RunConversationParams<TResult>): Promise<TResult> => {
  logger.info("Starting conversation", { budget });

  const history: EasyInputMessage[] = [];
  let turnsUsed = 0;
  let directive = await initHandler();

  while (true) {
    switch (directive.kind) {
      case DirectiveKind.Done: {
        logger.info("Conversation complete");

        return directive.result;
      }

      case DirectiveKind.Ask: {
        history.push({ role: "assistant", content: directive.message });
        responder.sendToUser(directive.message);
        logger.info("Asked user", { message: directive.message });

        const userReply = await responder.waitForResponse();
        history.push({ role: "user", content: userReply });
        turnsUsed++;
        logger.info("Turn complete", { userReply });

        if (turnsUsed > budget) {
          logger.warn("Budget exhausted", { budget });

          throw new ConversationBudgetExhaustedError(budget);
        }

        directive = await turnHandler(history, userReply, turnsUsed);
        logger.info("Turn handler returned", { kind: directive.kind });

        break;
      }

      default: {
        const _exhaustive: never = directive;
        throw new Error(
          `runConversation: unhandled directive ${JSON.stringify(_exhaustive)}`,
        );
      }
    }
  }
};
```

What the primitive does:
- Owns `history`, `turnsUsed`, and the I/O round-trip with the user.
- Calls into the phase via `initHandler` once at the start, then `turnHandler` after each user reply.
- Dispatches on `directive.kind` via a `switch` with a `default` arm whose `const _: never = directive` assignment enforces compile-time exhaustiveness — adding a future `Notify` variant without handling it will fail type-check rather than silently spin the loop.
- Has zero visibility into phase state.
- Generic only over `TResult` (the phase's final output type).

On logging: every assistant message and every user reply gets an `info` line. `turnsUsed` is **not** included in the log payloads — callers wire a session ID at a higher level, so turn position is recoverable from log sequence within a session. `budget` appears in `Budget exhausted` (warn) because it's the config value the caller picked, not derivable from the stream.

---

## Example — allocation

```ts
const collectAllocation = async (params): Promise<AllocationResult> => {
  // ── 1. Phase-owned state: plain locals in the closure ─────────────
  const proposedEquity = 70;        // from pickEquityPercentage(...)
  const proposedBuffer = 30;        // 100 - proposedEquity
  const counters: number[] = [];    // every counter the user proposes
  let hasShownDrawdownFraming = false;

  // ── 2. Init handler: produces the opening directive ───────────────
  const initHandler: InitHandler<AllocationResult> = async () => ({
    kind: DirectiveKind.Ask,
    message: `I propose ${proposedEquity}/${proposedBuffer}.`,
  });

  // ── 3. Turn handler: closure references the locals above ──────────
  const turnHandler: TurnHandler<AllocationResult> = async (history, userReply, _turnsUsed) => {
    const intent = await classifyIntent(history, userReply);

    if (intent.kind === "accept") {
      return {
        kind: DirectiveKind.Done,
        result: { equity: proposedEquity, buffer: proposedBuffer },
      };
    }

    if (intent.kind === "counter") {
      counters.push(intent.proposedEquity);
      hasShownDrawdownFraming = true;
      const text = await composeCounterResponse({ counters, hasShownDrawdownFraming });
      return { kind: DirectiveKind.Ask, message: text };
    }

    throw new Error(`unhandled intent: ${intent.kind}`);
  };

  // ── 4. Hand off to runConversation ────────────────────────────────
  return runConversation({ initHandler, turnHandler, budget: 5, responder });
};
```

See `T4_allocation_demo.ts` for the full runnable version (with stubbed LLM helpers + `completed`/`unresolved` mapping).

---

## Trace — one full conversation, three turns

User says `"what about 80/20?"` then `"yes I'm sure"`.

### Turn 0 — initial proposal

| Where | Action | Closure state | Primitive state |
|---|---|---|---|
| `initHandler()` called | returns `{kind: Ask, message: "I propose 70/30."}` | counters=[], framing=false | history=[], turns=0 |
| Primitive: `kind === Ask` → push, send, await | — | unchanged | history=[A:"I propose 70/30."], turns=0 |
| User replies `"what about 80/20?"` | push user, `turnsUsed++` | unchanged | history=[A,U:"what about 80/20?"], turns=1 |

### Turn 1 — counter-proposal

| Where | Action | Closure state | Primitive state |
|---|---|---|---|
| `turnHandler(history=[A,U], userReply="what about 80/20?", turnsUsed=1)` | classify → `{kind:"counter", proposedEquity:80}` | counters=[], framing=false | — |
| Inside turn: `counters.push(80)`, `hasShownDrawdownFraming = true` | mutates closure locals | **counters=[80], framing=true** | — |
| Turn composes reply (LLM call), returns `{kind: Ask, message: "..."}` | — | unchanged | — |
| Primitive: `kind === Ask` → push, send, await | — | unchanged | history=[A,U,A:"More aggressive..."], turns=1 |
| User replies `"yes I'm sure"` | push user, `turnsUsed++` | unchanged | history=[A,U,A,U:"yes I'm sure"], turns=2 |

### Turn 2 — accept

| Where | Action | Closure state | Primitive state |
|---|---|---|---|
| `turnHandler(history=[A,U,A,U], userReply="yes I'm sure", turnsUsed=2)` | classify → `{kind:"accept"}` | counters=[80], framing=true | — |
| Turn returns `{kind: Done, result:{equity:70, buffer:30}}` | — | unchanged | — |
| Primitive: `kind === Done` → return `directive.result` | done | — | — |

`collectAllocation` returns `{ equity: 70, buffer: 30 }`.

---

## T5/T6 knowledge access — agentic RAG

Design for how equity (T5) and buffer (T6) phases will answer in-conversation user questions (e.g. *"what's NASDAQ-100?"*, *"why Irish-listed?"*) using their `*.knowledge.md` files. The `runConversation` primitive itself does **not** change — this is entirely a handler-internal concern.

> **Subject to refinement during T5 implementation.** The decisions below (intent enum shape, two-tool surface, citation contract, classifier-first routing) are committed at the design-doc level but may be revised once the first phase is actually built and evaluated. The "Out of scope (still open)" subsection lists what is explicitly not yet decided.

### Problem

Equity (~170 LOC) and buffer (~100 LOC) knowledge files are too big to inline into every turn's prompt — appended on every call they bloat context, add latency, and add cost across the multi-turn conversation. We need a retrieval approach.

### Decision — agentic RAG, not inline

The knowledge file is loaded at boot but **not** appended to the prompt. The LLM is given retrieval tools and pulls only the sections it needs per turn. Inspired by the *Building Agentic RAG From Scratch in Pure Python* reference (filesystem-backed, no vector DB) — adapted to our smaller, heading-structured markdown.

### Why not a vector DB

Total knowledge content is ~270 LOC across phases. Embedding pipeline, vector index, and re-indexing on file edits are operational overhead with no payoff at this scale. Vector DBs shine when corpus is large (thousands of docs) and semantic similarity dominates exact match — neither applies here. Grep + agentic loop substitutes the LLM's own understanding for semantic similarity.

### Architecture — tools live inside `turnHandler`

The pattern stays within the existing `runConversation` design:

- `runConversation` owns the **outer** conversation loop (multi-turn dialog with the user).
- `turnHandler` owns an **inner** LLM tool-use loop *for one turn* — the LLM may call `grep` and/or `read_section` multiple times before composing its reply, then the handler returns a `Directive`.
- The primitive never sees the tools.

This gives a clean two-tier split:

| Tier | Loop | Decided by | Examples |
|---|---|---|---|
| Outer (conversation) | `runConversation` | **Code** (handler returns `Directive`) | Ask the user, accept, complete |
| Inner (one turn) | LLM tool-use round | **LLM** (function calls until done) | `grep("drawdown")`, `read_section("NASDAQ-100")` |

Two kinds of "tools" distinguished:
- **Data tools** — knowledge retrieval, LLM-internal, user never sees them. Live inside `turnHandler`.
- **Control tools** (e.g. `ask_user`) — do not exist as tools; replaced by `Directive.Ask`. Code, not LLM, decides when to ask.

### Tool surface (per phase)

System prompt for the handler's LLM call carries a small **TOC**: each `##` heading + one-line description per section (~150 tokens; cacheable as part of the static prompt). Section *order* is irrelevant — the TOC is a lookup index, not a reading order.

Two tools, scoped per phase. Each phase builds its own pair bound to its knowledge file (e.g. `makeEquityKnowledgeTools(equityKnowledgePath)`); no `phase` parameter at call time.

- **`grep(pattern: string): { section: string; lineNumber: number; lineText: string }[]`** — regex search across the phase's knowledge file. Used when the question is keyword-shaped or spans sections (e.g. *"where's drawdown discussed?"*).
- **`read_section(name: string): string`** — returns the full body of one `##` section. Typical call after the LLM has identified the right section from the TOC or from a grep result.

Expected typical turn: one `read_section` call. Grep is a fallback escape hatch when the TOC alone doesn't pin the right section.

### Patterns adopted from the agentic-RAG reference

- **Errors as human-readable strings**, not exceptions — e.g. `read_section("Foo") → "no section named 'Foo'; available: NASDAQ-100, S&P 500, …"`. The LLM reads the error and course-corrects on the next call without the handler needing retry logic.
- **Structured output with citations** — final LLM response carries `{ answer, citations: { section, quote }[] }`. Citations ground the answer (the LLM is told to only assert things it can cite) and become an evals signal.

### Routing — explicit classifier upstream of dispatch

A user reply in a knowledge-equipped phase can mean either **negotiation** (deterministic, code-driven state mutation) or **Q&A** (LLM-driven tool loop). `turnHandler` resolves this with an explicit classifier LLM call upstream of dispatch — *not* a single agentic loop with state-mutation and knowledge tools mixed together.

**Intent space (shape; per-phase enum varies):**
- `commit` — definitive choice (accept / pick / finalize)
- `discuss` — content question, no state change
- `counter` — alternative proposal
- `unknown` — unclear, re-prompt for clarification

**Per-turn flow:**

1. Classifier LLM call (small schema, low-effort) → `{ intent, extractedFields? }`.
2. Code dispatches on `intent`:
   - `commit` / `counter` → state mutation, return `Ask` or `Done`.
   - `discuss` → run inner tool-use loop (`grep` / `read_section`), compose answer, return `Ask`.
   - `unknown` → return `Ask` with a clarification request.

Worst case is 2 LLM rounds per turn (classifier + Q&A tool loop on `discuss`); best case is 1 (classifier only, for commit / counter / unknown). The Q&A loop is itself multi-step but those are tool calls within one chat-completion round.

**Why classifier-first** (confirmed against the Research-Plan-Implement methodology):

- **Same anchor as T4.** *"Don't use prompts for control flow if you can use control flow for control flow."* A mixed-tool loop would let the LLM decide whether to commit vs. ask vs. retrieve — that is control flow leaking into the prompt.
- **Instruction budget.** RPI puts the per-prompt budget at ~150–200 instructions. A single mixed-tool prompt documents knowledge tools *and* state-mutation tools together and burns through it; split prompts each stay well under.
- **"Dumb zone."** Model performance degrades as context fills with irrelevant tool docstrings and past reasoning. A mixed-tool loop puts knowledge-tool docs in front of the model on every turn — even when the user just says *"yes"* and no retrieval is needed. Classifier-first keeps Q&A tooling out of context until actually needed.
- **Evals.** Classifier accuracy and Q&A composition can be evaluated independently. Mixed-tool loop conflates them.

**Mixed-intent signal preservation.** The classifier schema explicitly handles compound replies like *"can I do NASDAQ-100? what's the drawdown like?"* — returns `intent: "discuss"` with `extractedCandidate: "NASDAQ-100"` so the handler can answer the question and re-ask with the candidate pre-filled. Included as a few-shot in the classifier prompt so signal isn't dropped.

### Classifier as convention, not enforced type

`turnHandler` stays free-form. We do **not** introduce a `ClassifyingTurnHandler<TIntent, TResult>` type, builder, or wrapper around the existing `turnHandler` shape.

- Each phase's intent set differs (allocation: accept/counter; equity: commit/discuss/counter; buffer: TBD). The classifier *schema* isn't shareable across phases.
- Per-intent dispatch bodies differ (allocation's counter pushes to `counters[]`; equity's counter swaps a candidate instrument). The *dispatch* isn't shareable either.
- The classifier call itself is small — one `callOpenAIParsed` with a schema and short instructions. Not worth a new abstraction to "save."
- Enforcement would either be too rigid (forces all phases through one shape) or too loose (a phase can still bypass — adds ceremony without safety).

If duplication materializes once allocation + equity + buffer are all implemented, the right extraction is a small `classifyIntent<T>(...)` *call helper*, not a handler-shape enforcer. Per the saved no-speculative-abstractions principle: every indirection must answer a concrete present use case.

### Out of scope (still open)

- Exact prompt structure for the inner tool-use loop (system prompt with tool docstrings + TOC + citation contract).
- Whether citations are user-facing or eval-only.

---

## Known caveats

- The handler is implicitly stateful — calling it twice with the same `(history, userReply, turnsUsed)` may not return the same thing because closure state has mutated between calls. Worth a one-line comment to set that contract for readers.
- `turnsUsed` is exposed to the turn handler but most phases will ignore it. YAGNI-flag candidate; defensible because it's cheap.
