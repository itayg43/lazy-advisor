# Clarify EF/Debt Phase — Behavior Rules

Behavioral rules for the EF/debt financial health check phase. Each entry: the rule, a one-line scenario, and the expected behavior for verifying correctness.

---

## 1. Emergency fund is asked first, debt second — in separate turns

**Rule:** The agent always asks the two questions in separate messages, in order: emergency fund first, then high-interest debt. They are never combined into a single message.

**Scenario:** Neither question has been asked — agent sends EF question only.

**Expected behavior:** First message asks only about emergency fund; debt question is sent in a subsequent turn.

---

## 2. Education is deferred until both questions are answered

**Rule:** No educational content is sent between the two questions. The agent moves directly from EF answer to the debt question.

**Scenario:** User says they have no emergency fund — agent asks about debt next without commenting on the EF answer.

**Expected behavior:** Debt question sent immediately after EF answer, no educational note in between.

---

## 3. No concerns → phase ends silently

**Rule:** If the user has an emergency fund and no significant high-interest debt, the phase ends without sending any message.

**Scenario:** User confirms both: has an emergency fund, no high-interest debt.

**Expected behavior:** Phase ends — no message sent, `ask_user` not called again.

---

## 4. At least one concern → single educational message + "proceed?"

**Rule:** If either concern is present, the agent sends exactly one educational message covering all present concerns, then asks "Would you like to continue with your investment plan anyway?"

**Scenario:** User has no emergency fund but no high-interest debt.

**Expected behavior:** One message explaining the EF risk, followed by the "proceed?" question.

---

## 5. Phase always ends after the user responds to "proceed?"

**Rule:** Any response to the "proceed?" question ends the phase. The agent does not loop, push back, or ask again.

**Scenario:** User says "no, I'll wait" in response to "proceed?".

**Expected behavior:** Phase ends — `ask_user` not called again regardless of the answer.

---

## 6. Mortgage is excluded from high-interest debt; clarification re-asks the current question only

**Rule:** If the user asks whether a mortgage counts, the agent explains it does not (secured, long-term, low-rate), then re-asks the current unanswered question — not both questions.

**Scenario:** Agent has asked about debt; user responds "does my mortgage count?"

**Expected behavior:** Agent explains mortgage is excluded, then re-asks the debt question only.

---

## 7. Other clarifying questions re-ask the current question only

**Rule:** For any other clarifying question (e.g., "what counts as an emergency fund?", "what's considered high-interest?"), the agent answers in 1–2 sentences, then re-asks the current unanswered question — not both questions.

**Scenario:** Agent has asked about emergency fund; user responds "what counts as one?"

**Expected behavior:** Agent explains in 1–2 sentences, then re-asks the EF question only.
