# Clarify Risk Phase — Behavior Rules

Behavioral rules for the risk phase. This phase resolves the user's willingness to tolerate temporary drops via a single 1-to-5 self-rating question. The phase output is the raw 1–5 score, emitted as `riskTolerance`. The downstream allocation phase keys its anchor table on that score directly — no `conservative`/`moderate`/`aggressive` bucket is computed, here or there.

The phase is willingness-only. Age and investment timeline are not passed as context and do not affect the question asked or the score.

## Neutrality (applies to all clarificationMessage responses)

- Do **not** suggest a "typical" answer or imply a socially-desired response.
- Do **not** add historical reassurance ("markets have recovered from 2008 and 2020"). Historical-recovery framing is a documented priming bias on risk-tolerance questionnaires and is the specific bias this design avoids.
- Do **not** introduce hypothetical drop scenarios. The scale itself is the elicitation; scenarios re-introduce the framing problem.
- Do **not** interpret free-form wording as a score (e.g., "I'd panic" → 1). Wording-based mapping is an LLM judgment call that is hard to audit and model-version-sensitive. Re-ask instead — the user will give a number.
- If evals reveal misclassification, tighten the score-extraction rules in code before adding scenario content back into the prompt.

---

## 1. User gives a clear 1–5 number → end the phase

**Rule:** If the user replies with one of the integers 1, 2, 3, 4, or 5 — as a digit or as an English word (`one`, `two`, `three`, `four`, `five`), with or without surrounding text — accept it and end the phase. Only the score is recorded.

**Scenarios** (extraction variants; all-digit and all-word coverage is owned by unit tests):

- `"1"` → riskTolerance: 1
- `"3"` → riskTolerance: 3
- `"5"` → riskTolerance: 5
- `"three"` → riskTolerance: 3 (word-form acceptance)
- `"I'd say 4"` → riskTolerance: 4 (digit embedded in surrounding text)

No budget impact — this terminates the phase successfully.

---

## 2. Anything else (non-numeric, out-of-range, decimal, vague) → re-ask within remaining budget, then hard-fail

**Rule:** If the user's reply is not a 1–5 integer (digit or English word), re-ask with the full scale (anchors included). For range or decimal inputs, briefly acknowledge that the scale needs a single whole number before re-presenting. After re-asking, if the user's next reply still doesn't yield a valid 1–5 integer, the budget is exhausted and the phase ends `unresolved`. This covers:

- Numbers outside 1–5 (`"7"`, `"0"`)
- Decimals or ranges (`"3.5"`, `"2-3"`) — acknowledge "single whole number needed" before re-presenting
- Non-numeric wording (`"I'd panic"`, `"absolutely not"`, `"buying opportunity"`)
- Vague answers (`"I don't know"`, `"depends"`)

**Scenarios:**

- `"7"` → re-ask → `"4"` → riskTolerance: 4
- `"I'd panic"` → re-ask → `"1"` → riskTolerance: 1
- `"3.5"` → re-ask (note: single whole number needed) → `"3"` → riskTolerance: 3
- `"2-3"` → re-ask (note: single whole number needed) → `"2"` → riskTolerance: 2

---

## 3. User asks a clarifying question → answer briefly, then re-present the scale

**Rule:** If the user asks for clarification before giving a score, answer briefly and honestly, then re-present the same 1–5 question with all three anchors in the same `ask_user` call. Do not skip the re-presentation. Both sub-cases below count toward the two-try budget.

**Sub-case (a) — General clarifying questions** (what the scale means, why we're asking, what "drop temporarily" means).

Answer in 1–2 sentences using the facts, then re-present the scale verbatim.

Scenario: `"What do you mean by drop temporarily?"` → brief explanation, then re-present the scale.

**Sub-case (b) — Capacity-framing questions** (age, investment timeline, "should my age affect this?").

Clarify in one sentence that the scale measures **willingness** (comfort with drops), not **capacity** (ability to recover over time). Re-present the scale. Must NOT use capacity-framed language — e.g., "with your 10-year timeline you can afford a higher score" is prohibited.

Scenario: `"Does my age or investment timeline change what score I should give?"` → brief willingness-vs-capacity clarification, then re-present the scale.

---

## Tool-call budget

`followUps: 2` → 3 total turns. The budget covers:

- Initial ask + invalid answer + Step 3 re-ask = 3
- Initial ask + clarifying Q re-presentation + Step 3 re-ask = 3
- Initial ask + clarifying Q re-presentation + valid answer = 2 (within budget)

If all 3 turns are consumed and no valid score is given, `askWithClassify` throws `ClassifyFollowUpsExhaustedError`. `askRisk` catches it via `mapClassifyError` and returns `{ status: "unresolved", reason: "risk_tolerance" }` silently.

---

## Last-run review

After every eval run, open `clarify.risk.last-run.md` and verify the capacity sub-case test (Rule 3 sub-case b) passed. The automated assertion checks for capacity-framing phrases — a pass does not guarantee natural tone, so spot-check the transcript when the test is borderline.
