# Clarify Risk Phase — Behavior Rules

Behavioral rules for the risk phase. This phase resolves one value: the user's risk tolerance (conservative, moderate, or aggressive). These internal labels are **never shown to the user** — they are inferred from behavior.

---

## 1. User picks A (sell) → conservative

**Rule:** If the user picks option A — exit the position and move to cash — end the phase immediately. The internal resolution is `conservative`.

**Scenario:** "I'd sell and move to cash."

**Extracted:** riskTolerance: conservative

---

## 2. User picks B (stay) then expresses stress → moderate

**Rule:** If the user picks option B and then says they would find the drop stressful to watch, end the phase. The internal resolution is `moderate`.

**Scenario:** "B. But yeah, I'd find that really stressful to watch."

**Extracted:** riskTolerance: moderate

---

## 3. User picks B (stay) then expresses calm → aggressive

**Rule:** If the user picks option B and then says they would stay calm or not worry, end the phase. The internal resolution is `aggressive`.

**Scenario:** "B. I'd stay pretty calm — I know it'll recover."

**Extracted:** riskTolerance: aggressive

---

## 4. "I don't know" or uncertain answer → educational fallback, re-ask

**Rule:** If the user gives a vague or uncertain answer ("I don't know", "not sure", "hard to say"), do not resolve the phase. Explain briefly why this matters, then re-ask. Do not end the phase.

**Explanation to use (adapt tone):** "That's a common feeling — it's hard to know until it happens. The reason it matters is that your tolerance for short-term losses should influence how your portfolio is structured. If a 20% drop would make you anxious to the point of wanting to sell, a more conservative mix reduces those swings. If you think you'd weather it without panic, you can take on more growth-oriented funds. Try to picture the scenario: your portfolio is down ₪[X] on paper. What's your gut reaction?"

Then re-ask the original question.

**Scenario:** "I don't know — it depends."

**Agent response:** [educational explanation] then re-ask A/B scenario or follow-up depending on context.

---

## 5. Market-timing answer → redirect, re-ask

**Rule:** If the user gives a market-timing answer — suggesting they'd evaluate based on the news, economic conditions, or what they expect the market to do — do not accept this as A or B. Explain why market timing is unreliable, then re-ask the original question.

**Explanation to use (adapt tone):** "That's a natural instinct, but research consistently shows that trying to time the market — selling before it falls further or buying at the bottom — usually backfires. Even professional fund managers underperform simple index strategies over the long run. The question is really about your default behavior in the absence of certainty: if you woke up and saw your portfolio was down 20%, and you had no idea whether it would recover next month or in three years, would you sell to stop the bleeding, or trust that staying invested is the right call?"

Then re-ask the original A/B scenario.

**Scenario:** "I'd check the news and see if it seems like a temporary dip or something more serious."

**Agent response:** [redirect explanation] then re-ask A/B scenario.

---

## 6. No clear signal after 2 uncertain turns → end phase, default to conservative

**Rule:** If the user has given 2 or more uncertain answers without a clear A or B signal, end the phase. The internal resolution defaults to `conservative`.

**Scenario:** User gives vague or uncertain answers twice in a row.

**Extracted:** riskTolerance: conservative
