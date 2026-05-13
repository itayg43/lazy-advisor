# Tasks

**Current task:** T9
**Next task:** T5

## Task Queue

| # | Task |
|---|------|
| T9 | Slim and align ef-debt phase |
| T5 | Equity |
| T6 | Buffer |

## Task Notes

### T9 — Slim and align ef-debt phase

Quality pass on the ef-debt phase, in the same spirit as T7 (parameters) and T8 (contribution). The goal is to fix actual quality issues — redundant prompt content, misalignment between prompts/rules/evals — **not** to restructure ef-debt to match the shape of another phase.

**Scope guard — read first.** This is a quality pass, not a restructure. ef-debt has its own shape: dual classify (`EmergencyFundClassify` + `DebtClassify`) in a single phase. Do **NOT** force it into the parameters/risk/contribution rule structure. Only change what is actually broken, redundant, or misaligned. If a section is fine, leave it alone — T8 ended up leaving `clarify.contribution.rules.md` untouched.

#### What to check

1. **Prompt slim.** Look for a `# Examples` section that duplicates branches already specified in `# Output Rules`. If every example is covered above, delete the section. Add inline tone anchors only for branches that lose coverage. Verify with eval; inspect `clarify.ef-debt.last-run.md` for tone regressions.

2. **Rules ↔ prompt alignment.** For each rule in `clarify.ef-debt.rules.md`, verify the prompt enforces it. For each prompted behavior, verify a rule documents it. Delete structural-only rules (code-enforced, no LLM judgment). Add missing rules. Do not merge or split rules for symmetry's sake — keep ef-debt's natural shape.

3. **Eval ↔ TESTING.md alignment.**
   - Test order matches ascending rule number (TESTING.md line 103).
   - Symmetric pairs collapsed into `it.each` when they differ only by input (line 9).
   - Every case has a rule-citation comment (line 101).
   - Test names match what they assert.
   - Coverage spans both `EmergencyFundClassify` and `DebtClassify` if rules are parallel.

#### Phase-specific notes

- ef-debt has two classifications in one phase. Verify whether they share a prompt or use separate prompts; slim each independently if separate.
- Treat parameters' amount/timeline symmetry as a reference point only — ef-debt's emergency-fund/debt pair may or may not justify a similar shape.

#### Concrete precedent — what T8 did for contribution

- Removed the `# Examples` section from the prompt (5 examples, all duplicating `# Output Rules` branches).
- Collapsed two symmetric eval pairs (Israel yes/no, DCA yes/no) into `it.each`; normalized an equity-amount assertion that previously only applied to the `→ yes` branch in each pair.
- Left `clarify.contribution.rules.md` untouched — no structural issues to fix.

Expect a similar small-surface-area outcome for T9.

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.ef-debt.eval.ts`. Inspect `clarify.ef-debt.last-run.md` for tone regressions.

---

### T5 — Equity

Resolves which equity instruments fill the equity bucket and how they split within it. Does not negotiate the equity percentage — that is allocation's job. `equityPercentage` is passed as grounding context.

#### Design pass — complete (preparatory; rules file + implementation still pending)

Followed the T6 pattern: full design pass using lazyinvestor.co.il source articles, before implementation. Knowledge file landed; rules file is the next preparatory step before implementation begins.

#### Output schema

```ts
type EquityAllocation = {
  name: string; // canonical for known anchors: "Single global fund" (FTSE All-World /
  // MSCI ACWI / MSCI World), "S&P 500", "NASDAQ-100", "TLV-125", "Russell 2000".
  // "Holy Trinity" expands into three separate allocations.
  percentage: number; // integer 0–100; within-equity split (sums to 100)
};

type EquityPhaseOutput = {
  allocations: EquityAllocation[]; // length ≥ 1; sum === 100
};
```

Zod: `allocations.length >= 1`, each `percentage` integer in [0, 100], sum === 100.

Add `EquityAllocationSchema` + `EquityPhaseOutputSchema` to a new `clarify/equity/clarify.equity.schemas.ts` (per-phase file, following the per-phase split pattern established in PR #142). Add `equity: EquityAllocation[]` to `UserProfileSchema`.

#### Anchor instruments — five canonical options

Two cores (typically the primary equity holding):

1. **Single global fund** — FTSE All-World / MSCI ACWI / MSCI World. EM-or-not is the primary decision axis; FTSE All-World is the pragmatic default.
2. **S&P 500** — defensible as a sole holding via internal sector + multinational diversification, with explicit pension-overlap caveat.

Three satellites (typically a small allocation alongside a core; user can pick any as 100% with a sanity-check turn):

3. **NASDAQ-100** — concentrated tech bet; ~80% drawdown / ~14yr recovery in dot-com bust.
4. **TLV-125** — small home-market complement; small-economy concentration risk.
5. **Russell 2000** — US small-cap completer; rate-sensitive; contested small-cap premium.

**Holy Trinity 3-fund split** (60% S&P 500 + 25% Europe + 15% EM) is documented in the knowledge file as an alternative for users who want explicit regional weights. **The phase does not propose it proactively** — only surfaces it on request. Sector ETFs are explicitly out of scope (knowledge file's "what we don't cover").

#### Conversation pattern — single flow, cold-open 2 cores + post-core tilt offer

No classifier. T5 runs as a single conversation flow:

- **Cold-open:** present the two cores (single global fund vs S&P 500) with one-line descriptions and the tradeoff between them (global diversification vs US-only with pension-overlap caveat). Do not lead with a strong default. The three satellites and Holy Trinity are not in the cold-open.
- **After the user picks a core:** offer the tilt question — "want to add a small satellite (NASDAQ-100 / TLV-125 / Russell 2000), or keep it as a single core holding?" Most users will keep it single; the tilt offer is one explicit branch rather than overwhelming the cold-open.
- **Directional signals mid-conversation** (e.g., user names "tech" or "Israeli market" up front): handle inline by jumping to the named satellite as the primary answer, with the appropriate sanity-check on concentration.
- **User names a US-listed instrument** (VOO, QQQ, SPY, VTI): surface the four-factor warning once (dividend withholding, distribution-vs-accumulating, US estate exposure, currency friction), then accept the user's final answer.
- **Multiple instruments named without percentages:** ask for the split.
- **Resolution:** confirm the final `EquityAllocation[]` (instruments + within-equity split) before returning.

Educational Q&A is supported during the loop — the user may ask clarifying questions about any anchor before committing. Knowledge content lives in `clarify.equity.knowledge.md` and is loaded into the system prompt at module init via `readFileSync`, mirroring the T6 buffer pattern.

**Sanity-check pattern (mirrors allocation Rule 3).** When a user picks a satellite as 100% (NASDAQ-100, TLV-125, or Russell 2000 alone) — or any choice that takes on outsized concentration — surface the concentration tradeoff once with concrete drawdown framing where available (NASDAQ ~80% / ~14yr; Russell 40–50% in 2008/2022; TLV-125 small-economy risk), then accept whatever the user decides. Do not re-challenge.

**Hard-fail on indecision (NOT soft-default).** Structurally different from T6 buffer's soft-default to קרן כספית. Equity choice is more consequential — a user who doesn't believe in their pick is more likely to panic-sell during a 30–50% drawdown, locking in losses. If the user can't converge after the natural conversation budget, deepen the educational layer first; if still unresolved, hard-fail rather than default. Aligns with T3.7/T3.8 hard-fail philosophy on profile-critical inputs.

**No risk-based instrument filtering.** Allocation sizing is the behavioral safeguard; the equity instrument choice is a preference question.

#### Design decisions

1. **Classifier dropped — single flow instead.** The originally-planned 4-case classifier (`resolved` / `split_missing` / `no_specific_instrument` / `no_equity_stated`) cannot run as designed: it required goal-text classification, but goal is consumed by intake and not propagated to T5 (consistent with every other post-intake phase). After dropping `resolved` and `split_missing` as tail cases not worth supporting in beginner scope, the remaining binary (directional signal vs nothing stated) is small enough to handle inline. Removes a classifier LLM call, a separate prompt, and classifier eval coverage.
2. **No goal pass-through.** Aligned with the rest of the pipeline. If T5 evals later show meaningful UX cost from losing the goal's equity hints, revisit with goal as ambient context (not for routing — just for the LLM to reference).
3. **Cold-open is 2 cores, not all 5.** Presenting all five anchors upfront is too much for a beginner. The 2-cores-then-tilt-offer pattern keeps the initial decision tractable while still exposing satellites for users who want them.
4. **Holy Trinity not in the cold-open.** A single global fund delivers very similar exposure with much less operational overhead. The Holy Trinity is in the knowledge file for users who specifically ask, but the phase does not propose it.
5. **Hard-fail rather than soft-default on indecision.** Intentionally inconsistent with T6 buffer's soft-default to קרן כספית. The equity drawdown magnitudes are large enough that a user who picks something they don't believe in is at meaningful risk of panic-selling — hard-fail is the safer outcome.
6. **Pension-overlap caveat surfaced once when user picks S&P 500 alone.** Many Israelis have actively chosen `מסלול S&P 500` in their pension or `קרן השתלמות` (popular opt-in since ~2020). Self-directed S&P 500 on top can mean concentration on top of concentration. Surface once, accept the user's final answer.
7. **Four-factor warning for US-listed instruments.** Dividend withholding (25% vs 15%/0% for Irish), distribution-vs-accumulating tax timing, US estate exposure ($60K threshold), currency friction. Surface once when the user names a US-listed instrument (VOO, QQQ, SPY, VTI), accept their final answer. US-listed has small structural advantages (slightly lower fees, tighter spreads) acknowledged in the knowledge file.

#### Context string format

```
Investment amount: ₪<amount>
Investment timeline: <timeline>
Risk tolerance: <riskTolerance>
Equity portion of portfolio: <equityPercentage>% (buffer is <bufferPercentage>%)
Plans to contribute periodically: yes | no (lump-sum investment)
```

#### Files

- `src/server/pipeline/stages/clarify/equity/clarify.equity.ts`
- `src/server/pipeline/stages/clarify/equity/clarify.equity.rules.md` — behavior rules (cold-open, tilt offer, sanity-check, hard-fail, four-factor warning, pension caveat, tool-call budget)
- `src/server/pipeline/stages/clarify/equity/clarify.equity.knowledge.md` — educational reference content (✅ created as prep work)
- `src/server/pipeline/stages/clarify/equity/clarify.equity.eval.ts`
- `src/server/pipeline/stages/clarify/equity/clarify.equity.schemas.ts` — new file: `EquityAllocationSchema`, `EquityPhaseOutputSchema`
- `src/server/pipeline/stages/clarify/equity/clarify.equity.types.ts` — new file: `EquityAllocation`, `EquityPhaseOutput` (inferred from schemas, per CONVENTIONS.md § Types)
- `src/server/schemas/pipeline.schemas.ts` — add `equity` field

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.equity.eval.ts`

---

### T6 — Buffer

Resolves which instrument fills the buffer (the "bonds half" / safe portion) of the portfolio. Presents three canonical anchor options, supports beginner Q&A about each, and converges on the user's choice.

The buffer concept is structural — it's the bonds half of a classic stocks+bonds lazy portfolio, with קרן כספית and government bond funds serving as the simplified, beginner-accessible options. It is **not** dropped from the user profile.

#### The three anchor options

1. **קרן כספית** (money market fund) — capital-stable, daily-liquid, no interest-rate risk
2. **קרן מחקה מדד אג"ח ממשלתי קצר** (short-term government bond fund — שקלי or צמוד מדד) — modest yield premium over קרן כספית, modest price volatility
3. **קרן מחקה מדד אג"ח ממשלתי כללי** (general government bond fund) — more real-return potential, more volatility

A fourth path: user may decline a buffer instrument entirely ("no buffer — emergency fund handled separately"). Resolved without pushback.

**Stay at the category level — never name specific tickers, fund providers, or specific yields/fees.** Fund availability and fees change; specific values go stale.

#### Output schema

```ts
type BufferChoice =
  | { kind: "money_market" }                  // קרן כספית
  | { kind: "short_gov_bond" }                // אג"ח ממשלתי קצר
  | { kind: "general_gov_bond" }              // אג"ח ממשלתי כללי
  | { kind: "none"; reason: string }          // emergency fund external, or 100% equity
  | { kind: "other"; description: string };   // user-named alternative

type BufferPhaseOutput = {
  buffer: BufferChoice;
};
```

A typed discriminated union (rather than the originally-planned free-form string) lets the plan-rendering stage tailor downstream language per choice — e.g., "your general bond fund will fluctuate with rate changes" vs "your money-market fund stays capital-stable."

#### Conversation pattern — cold 3-option presentation

Open by presenting the three options with one-line descriptions and inviting the user to pick or ask questions. Do **not** lead with a strong default.

Example opening: "For the safe portion, three reasonable options: [1] קרן כספית — money-market fund, capital-stable; [2] short-term government bond fund — slightly more yield, modest price volatility; [3] general government bond fund — more yield potential, more volatility. Which feels right, or want me to explain any of them?"

Educational Q&A is supported during the loop — the user may ask clarifying questions about any of the three categories before committing. Canonical educational content lives in `clarify.buffer.knowledge.md` and is loaded into the system prompt at module init via `readFileSync`.

**Soft default on indecision.** If the user can't decide after the natural conversation budget (e.g., 3–4 turns of "what do you recommend?" / "they all sound similar"), default to קרן כספית. Source-grounded: the lazyinvestor blog explicitly recommends קרן כספית for those who find bonds complex and don't want to learn. This is intentionally inconsistent with the hard-fail pattern in T3.7/T3.8 — the lazy-investor framing supports a graceful default here rather than aborting.

#### Knowledge content architecture

- `clarify.buffer.knowledge.md` — educational reference content (created as preparatory work). Topic sections: what is אג"ח, government vs corporate (incl. concentration-risk parallel with single-stock), duration (קצר vs כללי), שקלי vs צמוד מדד, why no USD, why funds vs individual bonds, tax treatment.
- **Loaded inline at module init** (one-time `readFileSync` at the top of `clarify.buffer.ts`, interpolated into the prompt template). Matches existing codebase pattern of inline-string prompts; cleaner authoring than embedding a multi-page string in a `.ts` file.
- **Architectural note:** inline embedding is the right call at the current ~100-line content size. If knowledge content grows past ~500 lines or starts being shared across phases, consider migrating to on-demand retrieval via a `lookup_concept` tool. Backlog item — do not build speculatively.
- **Staleness rule:** the knowledge content must not include specific rates, yields, fees, or fund-by-fund facts. Only mechanisms and direction.

#### Context string format

```
User goal: <goal>
Investment amount: ₪<amount>
Investment timeline: <timeline>
Risk tolerance: <riskTolerance>
Buffer portion of portfolio: <bufferPercentage>% (₪<amount × bufferPercentage / 100>)
Equity allocation (the other <equityPercentage>%): <equity.allocations formatted as "70% FTSE All-World, 30% TLV-125">
```

#### Files

- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.ts`
- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.rules.md` — behavior rules (anchor options, conversation pattern, soft default, terminology canonical names)
- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.knowledge.md` — educational reference content (✅ created as prep work)
- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.eval.ts`
- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.schemas.ts` — new file: `BufferChoiceSchema`, `BufferPhaseOutputSchema`
- `src/server/pipeline/stages/clarify/buffer/clarify.buffer.types.ts` — new file: `BufferChoice`, `BufferPhaseOutput` (inferred from schemas, per CONVENTIONS.md § Types)
- `src/server/schemas/pipeline.schemas.ts` — add `buffer` field

#### Design decisions

1. **Skip T6 when `bufferPercentage === 0`.** The allocation anchor table caps at 90% equity, but allocation Rule 3 explicitly allows the user to override to 100/0 via counter-proposal (with a sanity-check turn) — the rules file even has a worked 100/0 example. When `bufferPercentage === 0`, T6 returns `{ buffer: { kind: "none", reason: "100% equity allocation" } }` directly with no LLM call. No anchor-table change needed.
2. **"No buffer" mid-phase opt-out — MVP default = Option A (external).** When the user opts out of all three instruments mid-phase ("I have an emergency fund elsewhere"), the buffer money stays outside the plan and the allocation is unchanged. Plan output documents this explicitly (e.g., "plan: ₪21,000 in stock ETFs; remaining ₪9,000 stays in your bank as your external emergency cushion"). MVP does not disambiguate between "external" and "roll into equity" — see Backlog item for the post-MVP disambiguation work. Why this default: silently giving the user *less* market exposure than expected is recoverable; silently giving them *more* is a behavioral failure mode. Adding disambiguation later is non-breaking (`BufferChoice` already supports both via the `reason` field).

**Verify:** `npm run type-check`, `npm test`, `npm run test:evals -- clarify.buffer.eval.ts`

---

## Backlog

- **`print_to_user` tool (fire-and-forget).** Add a second tool alongside `ask_user` for sending a terminal message without waiting for a user response. Fixes the class of bugs where a phase sends a closing acknowledgment via `ask_user` and inadvertently waits for input. Requires changes to `ask-user.tool.ts`, `clarify.phase.ts` (`collectToolOutputs` currently rejects non-`ask_user` tools), and all phase prompts + evals that send terminal messages.

  **Also generalize `runPhaseLoop` / `collectToolOutputs` at the same time.** Today `collectToolOutputs` hardcodes the allowed tool name (`ASK_USER_TOOL.name`) and dispatches directly to `handleAskUser`. With a second tool, replace both with a tool-handler registry (`{ [name]: handler }`) keyed by tool name; the loop validates against the registry's keys and dispatches via the map. Two concrete tools provides the second example needed to design the registry shape correctly — doing it speculatively with one tool would just shuffle the hardcode up one level.

- **Hint/example at start of conversation.** Before the first `ask_user` call, send a brief framing message setting expectations and nudging the user toward a well-formed goal. Reduces unnecessary clarification turns by setting pipeline context before the first question.

- **Disambiguate "no buffer" opt-out path in T6.** MVP defaults to Option A (external — buffer money stays outside the plan, allocation unchanged) when the user opts out of all three buffer instruments. A second valid sub-case exists: the user wants the buffer money rolled into equity, with allocation updated to 100/0. Real eval data will tell us how often users mean each. If non-trivial, add a disambiguating rule to T6: when the user signals "no buffer instrument," ask one question to choose between *external* and *roll into equity*. Schema change is non-breaking — `BufferChoice` already supports both via the `reason` field (`"external emergency fund"` vs `"rolled into equity"`). Possibly mirror allocation's sanity-check language for extreme roll-ins (e.g., conservative user opting to roll 85% buffer into equity).
