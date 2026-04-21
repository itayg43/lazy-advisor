# Clarify Risk Phase — Behavior Rules

Behavioral rules for the risk phase. This phase resolves one value: the user's risk tolerance (conservative, moderate, or aggressive). These internal labels are **never shown to the user** — they are inferred from behavior across a two-tier probe: a 20% drop scenario on Turn 1, escalating to a 35% drop on Turn 2 if the user stays invested.

---

## 1. User picks A (sell) on Turn 1 → conservative

**Rule:** If the user picks option A on the 20% drop scenario — exit the position and move to cash — end the phase immediately. The internal resolution is `conservative`.

**Scenario:** "A — I'd sell and move to cash."

**Extracted:** riskTolerance: conservative

---

## 2. User picks B on Turn 1, then A on Turn 2 → moderate

**Rule:** If the user picks option B on the 20% drop scenario (stay invested), then picks option A on the 35% drop scenario (sell), end the phase. The internal resolution is `moderate`.

**Scenario:** "B. I'd stay invested." → Turn 2 35% scenario → "A. That's too much, I'd sell."

**Extracted:** riskTolerance: moderate

---

## 3. User picks B on Turn 1, then B on Turn 2 → aggressive

**Rule:** If the user picks option B on both the 20% and 35% drop scenarios (stay invested through both), end the phase. The internal resolution is `aggressive`.

**Scenario:** "B. I'd stay invested." → Turn 2 35% scenario → "B. Still stay — long-term growth."

**Extracted:** riskTolerance: aggressive

---

## 4. "I don't know" or uncertain answer → educational fallback, re-ask current turn

**Rule:** If the user gives a vague or uncertain answer ("I don't know", "not sure", "hard to say") and the educational fallback has not been given yet in this phase, do not resolve the phase. Explain briefly why this matters, then re-ask the **current turn's** scenario (Turn 1 or Turn 2, whichever was just asked). Do not end the phase.

**Explanation to use (adapt tone):** "That's a common feeling — it's hard to know until it happens. The reason it matters is that your tolerance for short-term losses should influence how your portfolio is structured. If a drop would make you anxious to the point of wanting to sell, a more conservative mix reduces those swings. If you think you'd weather it without panic, you can take on more growth-oriented funds. Try to picture it: your portfolio is down on paper. What's your gut reaction — sell to stop the bleeding, or stay invested and trust the recovery?"

Then re-ask the current turn's A/B scenario.

**Scenario:** "I don't know — it depends."

**Agent response:** [educational explanation] then re-ask the current turn's A/B scenario.

---

## 5. Market-timing answer → redirect, re-ask current turn

**Rule:** If the user gives a market-timing answer — suggesting they'd evaluate based on the news, economic conditions, or what they expect the market to do — do not accept this as A or B. Explain why market timing is unreliable, then re-ask the **current turn's** A/B scenario. This does not consume the educational fallback budget.

**Explanation to use (adapt tone):** "That's a natural instinct, but research consistently shows that trying to time the market — selling before it falls further or buying at the bottom — usually backfires. Even professional fund managers underperform simple index strategies over the long run. The question is really about your default behavior in the absence of certainty: if your portfolio was down and you had no idea whether it would recover next month or in three years, would your instinct be to sell, or to stay invested?"

Then re-ask the current turn's A/B scenario.

**Scenario:** "I'd check the news and see if it seems like a temporary dip or something more serious."

**Agent response:** [redirect explanation] then re-ask the current turn's A/B scenario.

---

## 6. Still uncertain after the educational fallback → end phase, default to conservative

**Rule:** If the educational explanation has already been given once during this phase and the user is still uncertain, end the phase. Do not ask again. The internal resolution defaults to `conservative`.

**Scenario:** User gives an uncertain answer, agent delivers the educational fallback + re-ask, user is still uncertain on the follow-up.

**Extracted:** riskTolerance: conservative
