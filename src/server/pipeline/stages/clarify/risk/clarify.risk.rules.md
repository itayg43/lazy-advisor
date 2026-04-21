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
- If evals reveal misclassification, tighten the score→bucket mapping in code before adding scenario content back into the prompt.

---

## 1. User gives a clear 1–5 number → end the phase

**Rule:** If the user replies with one of the integers 1, 2, 3, 4, or 5 (with or without surrounding text), accept it and end the phase. The score → bucket mapping is applied in code.

**Scenario:** "3"

**Extracted:** selfRatingScore: 3 → riskTolerance: moderate

---

## 2. Strong wording maps clearly to an extreme → end the phase

**Rule:** If the user does not give a number but uses wording that maps unambiguously to an extreme on the scale, accept it and end the phase. The extraction step is responsible for translating the wording to an integer.

**Examples (illustrative, not exhaustive):**

- "Absolutely not" / "I'd panic and sell" / "I'd hate that" → 1
- "Completely comfortable" / "I'd see it as a buying opportunity" → 5
- "Neutral" / "in the middle" / "uneasy but I'd hold" → 3

**Scenario:** "absolutely not, I'd want to sell"

**Extracted:** selfRatingScore: 1 → riskTolerance: conservative

---

## 3. User asks a clarifying question before answering → answer briefly, then re-present the scale

**Rule:** If the user asks for clarification (what the scale means, why we're asking, what "drop temporarily" means), answer briefly and honestly, then re-present the same 1–5 question with all three anchors in the same `ask_user` call. Do not skip the re-presentation.

**Scenario:** "What do you mean by drop temporarily?"

**Agent response:** brief explanation, then re-present the scale.

---

## 4. Number outside 1–5 or non-numeric, non-mappable answer → re-ask once, then default to conservative

**Rule:** If the user gives a number outside 1–5 (e.g., "7", "0") or a vague answer that does not map to a point on the scale (e.g., "I don't know", "depends"), re-ask once with the full scale (anchors included). If the user has already received one re-ask in this phase, do **not** re-ask again — end the phase silently. The extraction step will default to 1 (`conservative`).

**Why default conservative:** when willingness is genuinely unknown, the safer behavioral default is the lower-risk bucket. Defaulting to `moderate` would size a user toward an equity allocation they may not actually tolerate; defaulting to `conservative` errs toward a sizing they are more likely to hold through.

**Scenario:** "7" → re-ask → "I don't know" → end (default conservative).

**Extracted:** selfRatingScore: 1 → riskTolerance: conservative

---

## Tool-call budget

`MAX_RISK_TOOL_CALLS = 2`. Worst case is one re-ask after an invalid answer (initial ask + re-ask = 2) or one clarifying-question answer (initial ask containing answer + re-presentation, then user replies = 2). The budget does not accommodate both edge cases occurring in the same conversation.
