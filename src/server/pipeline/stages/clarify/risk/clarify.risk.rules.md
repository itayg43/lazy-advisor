# Clarify Risk Phase — Behavior Rules

Behavioral rules for the risk phase. This phase resolves the user's willingness to tolerate temporary drops via a single 1-to-5 self-rating question. The numeric score is mapped deterministically to one of three internal labels (`conservative`, `moderate`, `aggressive`) — these labels are **never shown to the user**.

The phase is willingness-only. Capacity factors (timeline, age, emergency fund, debt) are not used here — they belong to the allocation phase downstream.

## Score → bucket mapping

Mapping is deterministic and lives in code, not in prompts:

- 1–2 → `conservative`
- 3 → `moderate`
- 4–5 → `aggressive`

## Neutrality requirements

- Do **not** suggest a "typical" answer or imply a socially-desired response.
- Do **not** add historical reassurance ("markets have recovered from 2008 and 2020"). Historical-recovery framing is a documented priming bias on risk-tolerance questionnaires and is the specific bias this design avoids.
- Do **not** introduce hypothetical drop scenarios. The scale itself is the elicitation; scenarios re-introduce the framing problem.
- Do **not** interpret free-form wording as a score (e.g., "I'd panic" → 1). Wording-based mapping is an LLM judgment call that is hard to audit and model-version-sensitive. Re-ask instead — the user will give a number.
- If evals reveal misclassification, tighten the score→bucket mapping in code before adding scenario content back into the prompt.

---

## 1. User gives a clear 1–5 number → end the phase

**Rule:** If the user replies with one of the integers 1, 2, 3, 4, or 5 — as a digit or as an English word (`one`, `two`, `three`, `four`, `five`), with or without surrounding text — accept it and end the phase. The score → bucket mapping is applied in code.

**Scenarios:**

- `"3"` → selfRatingScore: 3 → riskTolerance: moderate
- `"three"` → selfRatingScore: 3 → riskTolerance: moderate
- `"I'd say 4"` → selfRatingScore: 4 → riskTolerance: aggressive

---

## 2. User asks a clarifying question before answering → answer briefly, then re-present the scale

**Rule:** If the user asks for clarification (what the scale means, why we're asking, what "drop temporarily" means), answer briefly and honestly, then re-present the same 1–5 question with all three anchors in the same `ask_user` call. Do not skip the re-presentation.

**Scenario:** "What do you mean by drop temporarily?"

**Agent response:** brief explanation, then re-present the scale.

---

## 3. Anything else (non-numeric, out-of-range, decimal, vague) → re-ask once, then default to conservative

**Rule:** If the user's reply is not a 1–5 integer (digit or English word), re-ask once with the full scale (anchors included). This covers:

- Numbers outside 1–5 (`"7"`, `"0"`)
- Decimals or ranges (`"3.5"`, `"2-3"`)
- Non-numeric wording (`"I'd panic"`, `"absolutely not"`, `"buying opportunity"`)
- Vague answers (`"I don't know"`, `"depends"`)

If the user has already received one re-ask in this phase, do **not** re-ask again — end the phase silently. The extraction step will default to 1 (`conservative`).

**Why default conservative:** when willingness is genuinely unknown, the safer behavioral default is the lower-risk bucket. Defaulting to `moderate` would size a user toward an equity allocation they may not actually tolerate; defaulting to `conservative` errs toward a sizing they are more likely to hold through.

**Scenarios:**

- `"7"` → re-ask → `"4"` → selfRatingScore: 4 → riskTolerance: aggressive
- `"I'd panic"` → re-ask → `"1"` → selfRatingScore: 1 → riskTolerance: conservative
- `"I don't know"` → re-ask → `"still not sure"` → end silently → selfRatingScore: 1 (default) → riskTolerance: conservative

---

## Tool-call budget

`MAX_RISK_TOOL_CALLS = 2`. Worst case is one re-ask after an invalid answer (initial ask + re-ask = 2) or one clarifying-question answer (initial ask + re-presentation = 2). The budget does not accommodate both a clarifying question **and** a subsequent invalid answer in the same conversation — in that rare case the phase ends silently and the extractor applies the default-conservative fallback.
