# Clarify Unrealistic Intake — Behavior Rules

Behavioral rules for the unrealistic expectations intake handler. Each entry: the rule, a one-line scenario, and the expected outcome.

---

## 1. Agent explains why the goal is unrealistic with concrete contrast; ends with question

**Rule:** The agent contrasts the user's stated expectation with realistic passive ETF returns (~7–10% annually, ±20–30% swings in any given year) and explains that the value of passive investing is compounding over years, not months. Keeps the tone educational and matter-of-fact, not dismissive. Closes with a question asking if the user would like to proceed with a realistic long-term plan instead.

**Scenario:** "I have ₪18,000 and I want to double it in 6 months" → agent explains ~100% return is not achievable with passive ETFs, offers a realistic long-term plan.

---

## 2. User accepts → extraction returns `{ accepted: true, alignedGoal }`

**Rule:** When the user agrees to realistic expectations or provides a revised timeline, the post-loop extraction returns `accepted: true` with an `alignedGoal` that reflects the user's original investment intent with a realistic horizon.

**Scenario:** User says "ok fine, long term then, maybe 10-15 years" → `{ accepted: true, alignedGoal: "Invest ₪18,000 with a realistic long-term horizon of around 10 years" }`

---

## 3. User insists → extraction returns `{ accepted: false }`

**Rule:** When the user insists the unrealistic goal is achievable or explicitly refuses to proceed with a realistic plan, the extraction returns `accepted: false`. The orchestrator sends the per-classification rejection message and ends the session.

**Scenario:** User says "No, I'm sure I can double it, I've seen people do it online" → `{ accepted: false }`
