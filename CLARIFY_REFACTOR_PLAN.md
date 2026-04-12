# Plan: Split Clarify Stage into Two Sequential Sub-Phases

## Context

The current `CLARIFY_SYSTEM_PROMPT` (~200 lines) mixes two distinct responsibilities in one prompt and one tool-calling loop:

1. **Field collection** — iterative targeted questions for required profile fields
2. **Portfolio defaults** — a one-time educational turn with equity anchors, compounding examples, and buffer explanation

Long, mixed-responsibility prompts hurt LLM instruction following. The refactor splits them into two focused prompts, each in its own file with its own loop. The external interface of `runClarifyStage` is unchanged.

---

## Final Folder Structure

```
clarify/
  clarify.constants.ts              ← shared constants (tool call caps, risk/knowledge levels)
  clarify.lib.ts                    ← NEW: shared helper (collectToolOutputs)
  clarify.stage.ts                  ← orchestration only (calls the three phases)
  clarify.stage.test.ts             ← orchestration unit test (mocks sub-functions)
  fields/
    clarify.fields.ts               ← NEW
    clarify.fields.test.ts          ← NEW
    clarify.fields.eval.ts          ← NEW (migrated from stage eval)
    CLARIFY_FIELDS_LAST_RUN.md      ← generated on first eval run
    clarify.fields.runs.jsonl       ← generated on first eval run
  preferences/
    clarify.preferences.ts          ← NEW
    clarify.preferences.test.ts     ← NEW
    clarify.preferences.eval.ts     ← NEW (migrated from stage eval)
    CLARIFY_PREFERENCES_LAST_RUN.md ← generated on first eval run
    clarify.preferences.runs.jsonl  ← generated on first eval run
  extraction/
    clarify.extraction.ts           ← MOVED from clarify/ root
    clarify.extraction.eval.ts      ← MOVED from clarify/ root
    CLARIFY_EXTRACTION_LAST_RUN.md  ← MOVED
    clarify.extraction.runs.jsonl   ← MOVED
```

Deleted: `clarify.stage.eval.ts`, `CLARIFY_STAGE_LAST_RUN.md`, `clarify.stage.runs.jsonl` — all 8 scenarios migrate to phase evals.

---

## Testing Strategy

| File | Unit test | Eval |
|------|-----------|------|
| `clarify.stage.ts` | Yes — mock the 3 sub-functions, assert call order and argument passing | No — retired |
| `clarify.fields.ts` | Yes — mock `callOpenAI`, 4 cases | Yes — 4 field-collection scenarios |
| `clarify.preferences.ts` | Yes — mock `callOpenAI`, 4 cases | Yes — 4 preferences scenarios |
| `clarify.extraction.ts` | No (unchanged) | Yes (unchanged) |

---

## Step 1 — Constants (`clarify.constants.ts`)

```typescript
export const MAX_FIELDS_TOOL_CALLS = 10;       // renamed from MAX_STAGE_TOOL_CALLS
export const MAX_PREFERENCES_TOOL_CALLS = 3;   // new
```

Rationale for 3: preferences phase has at most 3 turns (ask defaults → maybe ask split → done).

---

## Step 2 — `FIELDS_PROMPT` (in `clarify.fields.ts`)

`investmentPreferences` is **completely absent** — not listed, not mentioned.

Sections:
- **Role and Objective**: collect profile fields only; explicitly state "Do not mention investment preferences — those are handled in a separate phase after this one completes."
- **Behavior**: same rules as current (redirect OOS, handle contradictions, unrealistic expectations, stop-after-2-asks rule)
- **Required Fields** (8 fields): amount, age, riskTolerance, timeline, knowledgeLevel, hasEmergencyFund, hasDebt, monthlyContribution
- **Optional Fields**: brokerage defaults to `none`
- **Decision Logic** (2 steps):
  - Step 1: any required field missing/invalid → `ask_user` for only those fields
  - Step 2: all fields pass → respond "Got it, I have all the details I need."
- **Examples**:
  - Example 1: vague timeline → ask timeline only, next turn: fields done
  - Example 2: all fields complete on first message → done immediately

---

## Step 3 — `PREFERENCES_PROMPT` (in `clarify.preferences.ts`)

Role: collect `investmentPreferences` only. Full conversation history available via `previous_response_id` chaining.

Sections:
- **Role and Objective**: determine `investmentPreferences` only; do not re-ask fields already collected
- **Decision Logic** (4 steps):
  - Step 1: preferences stated but vague → `ask_user` for specific instrument/market
  - Step 2: preferences not yet stated → Portfolio Defaults
  - Step 3: multiple instruments named, no split → `ask_user` for split only
  - Step 4: preferences specific and complete → "Got it, I have everything I need."
- **Portfolio Defaults**: same content as current `clarify.stage.ts` — equity guard, equity anchors, buffer guard, buffer explanation
  - **Buffer guard extended**: skip if user mentioned bonds/AGGU/קרן כספית **or explicitly declined a buffer** — handles the case where the user volunteered "no buffer" during field collection
  - After user responds, re-apply step 3 if multiple instruments named without split
- **Examples**: follow-ups A–E only (no field-collection examples)

---

## Step 4 — `collectToolOutputs` (in `clarify.lib.ts`)

Move the existing `collectToolOutputs` helper from `clarify.stage.ts` into a new `clarify.lib.ts` file. Export it so both `clarify.fields.ts` and `clarify.preferences.ts` can import it.

```typescript
// clarify.lib.ts
export const collectToolOutputs = async (
  functionCalls: ResponseFunctionToolCall[],
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<ResponseInputItem.FunctionCallOutput[]> => { ... }
```

---

## Step 5 — `collectFields` and `collectPreferences`

Both exported from their respective files. Identical loop mechanics — initialization differs.

**`collectFields(goal, sendToUser, waitForResponse) → Promise<string>`** (in `clarify.fields.ts`)
```typescript
// Opens the conversation: input = goal string
let response = await callOpenAI({
  model: "gpt-5.4-nano",
  instructions: FIELDS_PROMPT,
  input: goal,           // string — opens conversation
  tools,
  reasoning: { effort: "low" },
});
// Loop with MAX_FIELDS_TOOL_CALLS cap
// Returns response.id after loop exits
```

**`collectPreferences(previousResponseId, sendToUser, waitForResponse) → Promise<string>`** (in `clarify.preferences.ts`)
```typescript
// Continues conversation: input = [] with previous_response_id
let response = await callOpenAI({
  model: "gpt-5.4-nano",
  instructions: PREFERENCES_PROMPT,
  previous_response_id: previousResponseId,  // chains to fields conversation
  input: [],             // no new user message — model re-evaluates from context
  tools,
  reasoning: { effort: "low" },
});
// Loop with MAX_PREFERENCES_TOOL_CALLS cap
// Returns response.id after loop exits
```

The `input: [] + previous_response_id` pattern is already established — `buildSourceParams` produces exactly this when passed a string response ID (used in extraction).

---

## Step 6 — Updated `runClarifyStage` (in `clarify.stage.ts`)

Pure orchestration — no prompt, no loop:

```typescript
import { collectFields } from "#pipeline/stages/clarify/fields/clarify.fields";
import { collectPreferences } from "#pipeline/stages/clarify/preferences/clarify.preferences";
import { extractUserProfile } from "#pipeline/stages/clarify/extraction/clarify.extraction";

export const runClarifyStage = async (goal, sendToUser, waitForResponse): Promise<UserProfile> => {
  logger.info("Starting clarify stage", { goal });
  const fieldsResponseId = await collectFields(goal, sendToUser, waitForResponse);
  const prefsResponseId  = await collectPreferences(fieldsResponseId, sendToUser, waitForResponse);
  const profile = await extractUserProfile(prefsResponseId);
  logger.info("Clarify stage complete");
  return profile;
};
```

---

## Step 7 — Unit Tests

### `clarify.stage.test.ts` — orchestration only

Mocks `collectFields`, `collectPreferences`, `extractUserProfile` directly. Does not mock `callOpenAI`.

```typescript
vi.mock("#pipeline/stages/clarify/fields/clarify.fields");
vi.mock("#pipeline/stages/clarify/preferences/clarify.preferences");
vi.mock("#pipeline/stages/clarify/extraction/clarify.extraction");
```

One primary test:
- Mock `collectFields` → `"resp_fields"`, `collectPreferences` → `"resp_prefs"`, `extractUserProfile` → `mockProfile`
- Assert: `collectFields` called with `(goal, sendToUser, waitForResponse)`
- Assert: `collectPreferences` called with `("resp_fields", sendToUser, waitForResponse)` — confirms chaining
- Assert: `extractUserProfile` called with `"resp_prefs"`
- Assert: result equals `mockProfile`

### `clarify.fields.test.ts` — 4 cases (same shape as current `clarify.stage.test.ts`)

1. No ask needed → done (1 `callOpenAI` returns text, loop exits)
2. One ask → done (2 `callOpenAI` calls: ask_user then text)
3. Unexpected tool name → throws `InternalError`
4. Cap exceeded → throws `InternalError` after `MAX_FIELDS_TOOL_CALLS` calls

### `clarify.preferences.test.ts` — 4 cases

1. Both guards fire → done in one call (1 `callOpenAI` returns text, no tool calls)
2. Portfolio defaults asked → user responds → done (2 `callOpenAI` calls)
3. Portfolio defaults asked → user names multiple instruments, no split → ask split → done (3 `callOpenAI` calls)
4. Cap exceeded → throws `InternalError` after `MAX_PREFERENCES_TOOL_CALLS` calls

Key assertion in test 2: first `callOpenAI` for preferences has `{ previous_response_id: <fieldsId>, input: [] }` — verifies the phase transition contract.

---

## Step 8 — Evals

### `clarify.fields.eval.ts` — 4 scenarios (migrated from `clarify.stage.eval.ts`)

- Unrealistic expectations redirect
- Out-of-scope redirect
- Contradiction resolution
- Stop probing after 2 asks

### `clarify.preferences.eval.ts` — 4 scenarios (migrated from `clarify.stage.eval.ts`)

Each starts with a synthetic `ResponseInputItem[]` transcript representing a completed field collection (passed as `input` to `collectPreferences`, bypassing the need for a real `previous_response_id`).

- Portfolio defaults presented, user picks equity + buffer
- Single instrument with buffer defaults
- Multiple instruments, no split → ask for split
- No-buffer: user declines, accepted without pushback

### `clarify.extraction.eval.ts` — unchanged (7 scenarios, moved to `extraction/`)

---

## Step 9 — Delete / Move

- **Create**: `clarify.lib.ts` — move `collectToolOutputs` from `clarify.stage.ts`
- **Delete**: `clarify.stage.eval.ts`, `CLARIFY_STAGE_LAST_RUN.md`, `clarify.stage.runs.jsonl`
- **Move to `extraction/`**: `clarify.extraction.ts`, `clarify.extraction.eval.ts`, `CLARIFY_EXTRACTION_LAST_RUN.md`, `clarify.extraction.runs.jsonl`
- **Update imports**: any file importing from the old `clarify.extraction.ts` path (primarily `clarify.stage.ts`)

---

## Verification

1. `npm run type-check` — no references to old paths or renamed constants (`MAX_STAGE_TOOL_CALLS` → `MAX_FIELDS_TOOL_CALLS`)
2. `npm run format && npm run lint`
3. `npm test` — all unit tests pass (`clarify.stage`, `clarify.fields`, `clarify.preferences`)
4. `npm run test:evals -- src/server/pipeline/stages/clarify/fields/clarify.fields.eval.ts`
5. `npm run test:evals -- src/server/pipeline/stages/clarify/preferences/clarify.preferences.eval.ts`
6. `npm run test:evals -- src/server/pipeline/stages/clarify/extraction/clarify.extraction.eval.ts`
