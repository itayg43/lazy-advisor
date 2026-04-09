# Task: Docs Restructure + Eval Transcript Capture

Cross-cutting improvement — not tied to a pipeline section. Can be executed independently of any feature work.

---

## Context

Two related improvements:

1. **Docs restructure**: `WORKFLOW_EXAMPLES.md` has grown bloated — full verbatim conversations, a story-to-stage mapping table, and detailed stage behavior mixed together. It serves two audiences (overall flow orientation vs. stage-specific behavior) and does neither well.

2. **Eval transcript capture**: Eval tests log only pass/fail + token metadata to `.runs.jsonl`. The full conversation (what the model asked, what the scripted user responded, what was extracted) is invisible — hard to debug failures or verify model behavior without re-running with debug logs.

---

## Part 1: Docs Restructure

### Files to change

| File | Change |
|------|--------|
| `documentation/workflow/WORKFLOW_EXAMPLES.md` | Strip to lean version — see below |
| NEW `documentation/workflow/CLARIFY_EXAMPLES.md` | Detailed clarify stage scenarios organized by behavior |
| `documentation/workflow/WORKFLOW.md` | Add reference to per-stage example files |
| `CLAUDE.md` References table | Add per-stage example files row |

### WORKFLOW_EXAMPLES.md — what stays, what goes

**Stays:**
- Intro paragraph + Agent Behavior Principles
- Story 1 — abbreviated to ~1 paragraph per stage (no verbatim agent text, just what happens and why)
- Story 2 — 2-3 sentences: simple adjustment without re-research
- Story 3 — 2-3 sentences: iteration that triggers re-research
- Story 9 — iteration limit (pipeline-wide behavior)
- Story 10 — search failure / hard stop (pipeline-wide)

**Removed:**
- Full verbatim conversations in Stories 1-3
- Stories 4, 5, 6, 7, 8, 11, 12 (stage-specific — moved to `CLARIFY_EXAMPLES.md`)
- Story-to-stage mapping table (no longer maintained)

### CLARIFY_EXAMPLES.md — structure

One file per stage, organized by behavior — not story numbers, no connection to workflow examples numbering. Each scenario has: **Rule** (one sentence), **Conversation** (actual turns), **What gets extracted**.

Scenarios:
1. **Complete beginner, no preferences → portfolio defaults flow** — full equity allocation + buffer question with a custom split answer
2. **Vague timeline → accepted after second ask** — stops probing, takes best available answer
3. **Contradictory risk → scenario-based resolution** — teaches tradeoff, uses scenario to find real tolerance
4. **Out-of-scope stock picking → ETF redirect** — redirects toward ETF-based investing
5. **Stated preferences in goal → portfolio defaults skipped** — guard fires, stage completes without asking equity question
6. **Multiple instruments without split → split required** — asks for percentage before treating as complete
7. **100% single-index concentration → valid, captured** — 100% NASDAQ accepted, not pushed back on
8. **Advanced user → knowledge level matched** — skips ETF-101, engages on specifics

---

## Part 2: Eval Transcript Capture

### Design

**What to capture per test:** goal/input → model question turns + scripted user responses → final extracted profile.

**Format:** Markdown, human and LLM readable. One file per eval spec, cleared at the start of each run and appended per test. Committed to git — serves as living documentation of real model behavior for new users and LLMs entering a session cold.

**Output path convention:** `<eval-file>.last-run.md` alongside the eval file.
Examples: `clarify.stage.last-run.md`, `clarify.extraction.last-run.md`

**File format:**
```markdown
# Clarify Stage Eval — Last Run
Timestamp: 2026-04-09T02:36:33Z | Commit: 77a231f

---

## ✓ should handle unrealistic expectations... (25831ms)

**Goal:** "I have ₪18,000 and I want to double it in 6 months"

**Agent:** When you say you want to double ₪18,000 in 6 months...
**User:** ok fine, long term then, maybe 10-15 years, moderate risk
**Agent:** Great. A few more details I need...
**User:** I'm 24, yes to emergency fund...

**Extracted profile:**
amount: 18000 | age: 24 | risk: moderate | timeline: 10-15 years | ...

---

## ✗ some failing test (20094ms)
Error: Clarify stage failed to converge within 10 tool calls
```

### Files to change

| File | Change |
|------|--------|
| NEW `src/server/pipeline/eval.transcript.ts` | `createTrackedResponder` + `initLastRun` + `appendLastRunEntry` utilities |
| `src/server/pipeline/stages/clarify/clarify.stage.eval.ts` | Replace `createScriptedResponder` with `createTrackedResponder`; add `beforeAll` + `afterEach` hooks; set module-level `lastGoal/lastTranscript/lastProfile` in each test |
| `src/server/pipeline/stages/clarify/clarify.extraction.eval.ts` | Add `initLastRun` + `appendLastRunEntry` with static transcript + extracted profile |
| `CLAUDE.md` "Before committing" rule | Add: commit updated `*.last-run.md` files after running evals |

### eval.transcript.ts — exports

```typescript
type TranscriptEntry = { role: "agent" | "user"; content: string };

// Replaces createScriptedResponder — same interface, adds tracking
createTrackedResponder(responses: string[]): {
  sendToUser: SendToUser;       // captures model questions
  waitForResponse: WaitForResponse; // returns scripted response + captures it
  transcript: TranscriptEntry[];
}

// Called in beforeAll — clears the file and writes the run header
initLastRun(filePath: string): void

// Called in afterEach — appends one test block
appendLastRunEntry(filePath: string, entry: {
  name: string;
  passed: boolean;
  durationMs: number;
  goal?: string;
  transcript: TranscriptEntry[];
  profile?: unknown;
  error?: string;
}): void
```

### Test pattern

```typescript
const LAST_RUN_PATH = new URL("clarify.stage.last-run.md", import.meta.url).pathname;

let lastGoal: string | undefined;
let lastTranscript: TranscriptEntry[] | undefined;
let lastProfile: unknown | undefined;

beforeAll(() => initLastRun(LAST_RUN_PATH));

afterEach((ctx) => {
  if (!lastTranscript) return;
  appendLastRunEntry(LAST_RUN_PATH, {
    name: ctx.task.name,
    passed: !ctx.task.result?.errors?.length,
    durationMs: ctx.task.result?.duration ?? 0,
    goal: lastGoal,
    transcript: lastTranscript,
    profile: lastProfile,
  });
  lastGoal = lastTranscript = lastProfile = undefined;
});

it("should handle unrealistic expectations...", async () => {
  lastGoal = "I have ₪18,000 and I want to double it in 6 months";
  const responder = createTrackedResponder([...]);
  lastProfile = await runClarifyStage(lastGoal, responder.sendToUser, responder.waitForResponse);
  lastTranscript = responder.transcript;
  // assertions follow
});
```

`afterEach` uses `ctx.task.result` — pass/fail is known without try/catch in every test. Transcript captured even when assertions fail.

---

## Verification

```bash
npm run lint
npm run format:check
npm run type-check
npm test
npm run test:evals -- src/server/pipeline/stages/clarify/clarify.stage.eval.ts
npm run test:evals -- src/server/pipeline/stages/clarify/clarify.extraction.eval.ts
```

After running evals, verify:
- `clarify.stage.last-run.md` and `clarify.extraction.last-run.md` exist with full conversations
- Files are overwritten (not accumulated) on a second run
- Files are committed to git alongside `*.runs.jsonl`
