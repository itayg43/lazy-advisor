# Clarify Risk Phase — Behavior Rules

Behavioral rules for the risk phase. This phase resolves the user's willingness to tolerate temporary drops via a single 1-to-5 self-rating question. The numeric score is mapped deterministically to one of three internal labels (`conservative`, `moderate`, `aggressive`) — these labels are **never shown to the user**.

The phase is willingness-only. Capacity factors (timeline, age) are available as context but do not affect the question asked or the score mapping — both remain willingness-only. They may be referenced when answering clarifying questions (e.g., "does my age affect what score I should give?").

## Score → bucket mapping

Mapping is deterministic and lives in code, not in prompts:

- 1–2 → `conservative`
- 3 → `moderate`
- 4–5 → `aggressive`

One case per branch is covered by unit tests (`clarify.risk.test.ts`). Eval tests need one representative digit per bucket — not all five — to confirm LLM extraction wires through to the correct bucket.

## Neutrality requirements

- Do **not** suggest a "typical" answer or imply a socially-desired response.
- Do **not** add historical reassurance ("markets have recovered from 2008 and 2020"). Historical-recovery framing is a documented priming bias on risk-tolerance questionnaires and is the specific bias this design avoids.
- Do **not** introduce hypothetical drop scenarios. The scale itself is the elicitation; scenarios re-introduce the framing problem.
- Do **not** interpret free-form wording as a score (e.g., "I'd panic" → 1). Wording-based mapping is an LLM judgment call that is hard to audit and model-version-sensitive. Re-ask instead — the user will give a number.
- If evals reveal misclassification, tighten the score→bucket mapping in code before adding scenario content back into the prompt.

---

## 1. User gives a clear 1–5 number → end the phase

**Rule:** If the user replies with one of the integers 1, 2, 3, 4, or 5 — as a digit or as an English word (`one`, `two`, `three`, `four`, `five`), with or without surrounding text — accept it and end the phase. The score → bucket mapping is applied in code.

**Scenarios** (one per bucket + extraction variants; all-digit and all-word coverage is owned by unit tests):

- `"1"` → selfRatingScore: 1 → riskTolerance: conservative
- `"3"` → selfRatingScore: 3 → riskTolerance: moderate
- `"5"` → selfRatingScore: 5 → riskTolerance: aggressive
- `"three"` → selfRatingScore: 3 → riskTolerance: moderate (word-form acceptance)
- `"I'd say 4"` → selfRatingScore: 4 → riskTolerance: aggressive (digit embedded in surrounding text)

---

## 2. User asks a clarifying question before answering → answer briefly, then re-present the scale

**Rule:** If the user asks for clarification (what the scale means, why we're asking, what "drop temporarily" means), answer briefly and honestly, then re-present the same 1–5 question with all three anchors in the same `ask_user` call. Do not skip the re-presentation.

**Scenario:** "What do you mean by drop temporarily?"

**Agent response:** brief explanation, then re-present the scale.

---

## 3. Anything else (non-numeric, out-of-range, decimal, vague) → re-ask within remaining budget, then hard-fail

**Rule:** If the user's reply is not a 1–5 integer (digit or English word), re-ask with the full scale (anchors included). For range or decimal inputs, briefly acknowledge that the scale needs a single whole number before re-presenting. Re-asking continues for as long as the tool-call budget allows; see the budget section for hard-fail behavior. This covers:

- Numbers outside 1–5 (`"7"`, `"0"`)
- Decimals or ranges (`"3.5"`, `"2-3"`) — acknowledge "single whole number needed" before re-presenting
- Non-numeric wording (`"I'd panic"`, `"absolutely not"`, `"buying opportunity"`)
- Vague answers (`"I don't know"`, `"depends"`)

**Scenarios:**

- `"7"` → re-ask → `"4"` → selfRatingScore: 4 → riskTolerance: aggressive
- `"I'd panic"` → re-ask → `"1"` → selfRatingScore: 1 → riskTolerance: conservative
- `"3.5"` → re-ask (note: single whole number needed) → `"3"` → selfRatingScore: 3 → riskTolerance: moderate
- `"2-3"` → re-ask (note: single whole number needed) → `"2"` → selfRatingScore: 2 → riskTolerance: conservative

---

## 4. Capacity questions (age/timeline) → clarify willingness vs capacity, re-present scale

**Rule:** If the user asks whether their age or investment timeline should affect their score, briefly clarify that the scale measures willingness (comfort with drops), not capacity (ability to recover over time). Do not use timeline or age to suggest or frame a score. Then re-present the 1–5 question with all three anchors.

**Scenario:** "Does my age or investment timeline change what score I should give?"

**Agent response:** brief clarification that the scale is about willingness, not capacity, then re-present the scale. Must NOT say things like "with your 10-year timeline you can afford a higher score."

---

## Tool-call budget

`followUps: 2` → 3 total turns. Worst case: clarifying question (T1 initial ask + T2 re-presentation after Q) followed by an invalid answer (T3 Step 3 re-ask) = 3 turns. The budget covers:

- Initial ask + invalid answer + Step 3 re-ask = 3
- Initial ask + clarifying Q re-presentation + Step 3 re-ask = 3
- Initial ask + clarifying Q re-presentation + valid answer = 2 (within budget)

If all 3 turns are consumed and no valid score is given, the phase ends silently. The extraction returns null and the phase hard-fails with `risk_missing`.

**Scenarios:**

- `"What does drop temporarily mean?"` → re-present → `"2-3"` → Step 3 re-ask → `"2"` → selfRatingScore: 2 → riskTolerance: conservative
- `"What does drop temporarily mean?"` → re-present → `"I still can't decide"` → Step 3 re-ask → `"Honestly I still can't say"` → budget exhausted → `{ status: "failure", reason: "risk_missing" }`
- `"I don't know"` → re-ask → `"still not sure"` → re-ask → `"I really can't"` → budget exhausted → `{ status: "failure", reason: "risk_missing" }`

---

## Last-run review

After every eval run, open `clarify.risk.last-run.md` and verify the capacity deflection test (Rule 4) passed. The automated assertion checks for capacity-framing phrases — a pass does not guarantee natural tone, so spot-check the transcript when the test is borderline.
