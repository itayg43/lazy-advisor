# Clarify EF/Debt Phase — Behavior Rules

Behavioral rules for the EF/debt financial health check phase. Rules cover LLM classification behavior — conversation flow (question order, education trigger, silent exit) is enforced by code and tested in unit tests.

Each entry: the rule, a one-line scenario, and the expected behavior for verifying correctness.

---

## 1. Mortgage is excluded from high-interest debt

**Rule:** If the user asks whether a mortgage counts as high-interest debt, the agent explains it does not in 1–2 sentences. The question is not re-stated — the user responds naturally on the next turn.

**Scenario:** Agent has asked about debt; user responds "does my mortgage count?"

**Expected behavior:** Agent explains mortgage is excluded in 1–2 sentences. No re-ask of the debt question.

---

## 2. Clarifying questions are answered in 1–2 sentences — no re-ask

**Rule:** For any clarifying question (e.g., "what counts as an emergency fund?", "what's considered high-interest?"), the agent answers in 1–2 sentences using the key facts. The original question is not re-stated — the user responds naturally on the next turn. Applies to both the EF and debt questions.

**Scenario:** Agent has asked about emergency fund; user responds "what counts as one?"

**Expected behavior:** Agent explains in 1–2 sentences. No re-ask of the EF question.

---

## 3. Deflection or off-topic response → redirect back

**Rule:** If the user deflects (e.g., "skip this", "I don't want to answer") or goes off-topic, the agent redirects them firmly — without negotiating or validating the deflection — back to answer the current question. Applies to both the EF and debt questions.

**Scenario:** Agent has asked about emergency fund; user responds "skip this".

**Expected behavior:** Agent sends a firm redirect (e.g., "I need your answer to continue — do you have 3–6 months of expenses set aside?") and does not acknowledge or accommodate the deflection.

---

## 4. Ambiguous answer → ask for clarification

**Rule:** If the user gives an ambiguous or unclear answer (e.g., "I have some savings", "I think so?", "kind of?"), the agent asks them to be more specific rather than treating the response as a yes or no. Applies to both the EF and debt questions.

**Scenario:** Agent has asked about emergency fund; user responds "I have some savings".

**Expected behavior:** Agent asks the user to clarify (e.g., whether they have 3–6 months of expenses set aside in a liquid account).

---

## 5. Mixed message → answer the embedded question, then confirm the answer

**Rule:** If the user both answers and asks a follow-up question (e.g., "Yes, but does a savings account count?"), the agent answers the question first, then asks the user to confirm their answer. The answer field is only extracted after explicit confirmation on the next turn.

**Scenario:** Agent has asked about emergency fund; user responds "Yes, but does a savings account count?"

**Expected behavior:** Agent answers whether a savings account qualifies, then asks the user to confirm their yes/no answer.

---

## 6. Follow-up exhaustion → conservative default

**Rule:** If the model fails to converge after all follow-ups, the phase applies a conservative default: EF defaults to `false` (no EF → education sent), debt defaults to `true` (has debt → education sent). Rationale: when in doubt, educate.

**Scenario (EF):** User gives three ambiguous EF responses — follow-ups are exhausted without a clear yes/no.

**Expected behavior:** EF education is shown.

**Scenario (debt):** User gives three ambiguous debt responses — follow-ups are exhausted without a clear yes/no.

**Expected behavior:** Debt education is shown.

---

## Watch Items (check after evals)

- **Mixed message + Option B.** Current design (Option A): when user both answers and asks a question (e.g. "Yes, but does a savings account count?"), `answer` is set to null, the question is answered, and the answer is re-confirmed on the next turn. If evals show this breaks or causes too many retries, consider Option B: allow `answer` to be non-null when `clarificationNeeded: true` so the orchestrator can use the answer immediately without an extra round-trip. Trade-off: breaks the clean discriminated contract, adds orchestrator complexity.

- **Retries bump to 3.** Default is 2. A mixed message followed by two clarifying questions in a row needs 4 attempts total — retries=2 exhausts before resolving. If evals surface this scenario failing, bump `ASK_WITH_CLASSIFY_DEFAULT_RETRIES` to 3.
