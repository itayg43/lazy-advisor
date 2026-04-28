# Clarify Unrealistic Intake — Behavior Rules

Behavioral rules for the unrealistic expectations intake handler. Each entry: the rule, a one-line scenario, and the expected outcome.

---

## 1. Agent explains why the goal is unrealistic with concrete contrast; ends with question

**Rule:** The agent contrasts the user's stated expectation with realistic passive ETF returns (~7–10% annually, ±20–30% swings in any given year) and explains that the value of passive investing is compounding over years, not months. Keeps the tone educational and matter-of-fact, not dismissive. Closes with a question asking if the user would like to proceed with a realistic long-term plan instead.

**Scenario:** "I have ₪18,000 and I want to double it in 6 months" → agent explains ~100% return is not achievable with passive ETFs, offers a realistic long-term plan.

---

## 2. User accepts → extraction returns `{ accepted: true }`

**Rule:** When the user explicitly agrees to proceed with realistic expectations (e.g., "ok, let's do long-term", "sounds good", "I understand"), the post-loop extraction returns `{ accepted: true }`. A revised timeline only counts if the user has dropped the original return target — not if they're still implying the same unrealistic gain on a shorter horizon (those go to Rule 3).

**Scenario:** User says "ok fine, long term then, maybe 10-15 years" → `{ accepted: true }`

---

## 3. User proposes a revised but still unrealistic timeline → agent re-redirects once

**Rule:** If the user responds with a revised timeline or target that is still unrealistic (e.g., "maybe in 2 years" — doubling in 2 years still requires ~41%/year), the agent briefly explains in one or two sentences why the revised expectation is still not achievable with passive ETFs and asks once more if they'd like to proceed with a realistic plan. This fires at most once.

**Scenario:** User says "ok fine, maybe in 2 years then" → agent explains 2-year doubling still requires ~41%/year → asks again.

---

## 4. User insists or disengages → extraction returns `{ accepted: false }`

**Rule:** When the user insists the unrealistic goal is achievable, refuses to proceed with a realistic plan, or disengages — at any point in the conversation — the extraction returns `accepted: false`. The orchestrator sends the per-classification rejection message and ends the session.

**Scenario:** User says "No, I'm sure I can double it, I've seen people do it online" → `{ accepted: false }`
**Scenario:** After re-redirect, user says "No, I really think 2 years is enough" → `{ accepted: false }`
**Scenario:** After re-redirect, user says "forget it, this isn't what I was looking for" → `{ accepted: false }`
