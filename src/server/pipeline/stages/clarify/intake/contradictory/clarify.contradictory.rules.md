# Clarify Contradictory Intake — Behavior Rules

Behavioral rules for the contradictory risk intake handler. Each entry: the rule, a one-line scenario, and the expected outcome.

---

## 1. Agent acknowledges contradiction and presents a concrete loss scenario; no field collection

**Rule:** The agent briefly frames the contradiction as a common tension (not a mistake), then presents a concrete loss scenario (A: sell, B: hold, C: buy more) to surface real risk preference. Shekel figures are adapted to any amount the user mentioned in their goal; otherwise ₪10,000 is used as a generic example. The scenario question is the close — no additional questions in the same call. No profile or data collection questions are asked in this phase.

**Scenario:** "I want maximum returns but I can't afford to lose any money" → agent frames the tension, presents 20% drop scenario with A/B/C options.

---

## 2. User resolves contradiction → extraction returns `{ accepted: true }`

**Rule:** When the user gives a clear answer to the scenario that reveals a risk preference (even implicitly), the post-loop extraction returns `{ accepted: true }`.

**Scenario:** User says "I'd feel sick but I'd hold and wait for recovery" → `{ accepted: true }`

---

## 3. User disengages → extraction returns `{ accepted: false }`

**Rule:** When the user disengages, refuses to answer, or says they are no longer interested, the extraction returns `accepted: false`. The orchestrator sends the per-classification rejection message and ends the session.

**Scenario:** User says "I don't know, forget it, I'm not interested anymore" → `{ accepted: false }`

---

## 4. User asks a clarifying question → agent answers briefly and re-presents the scenario

**Rule:** When the user asks a clarifying question (e.g., "why does this matter?", "what is risk tolerance?") instead of answering the A/B/C scenario, the agent answers briefly via `ask_user` (one or two sentences), notes that specifics will be covered later, and re-presents the scenario. The user's response to the re-presented scenario determines acceptance per rules 2 and 3.

**Scenario:** Agent presents A/B/C scenario → user asks "why does this matter?" → agent answers briefly and re-presents the scenario → user picks an option → `{ accepted: true }`.
