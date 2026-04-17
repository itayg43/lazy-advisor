# Clarify Stage — Behavior Rules

Behavioral rules for the clarify stage. Each entry: the rule, a one-line scenario, and the fields that matter for verifying correctness.

---

## 1. Complete beginner, no preferences → portfolio defaults flow

**Rule:** When no investment preference has been stated after all required fields are collected, ask the portfolio defaults question — equity allocation options with compound projections, and a קרן כספית suggestion for the buffer. This applies to all users regardless of knowledge level.

**Scenario:** ₪55,000, beginner, no preferences stated.

**Extracted:** amount: 55000 | age: 28 | risk: moderate | timeline: ~20 years | investmentPreferences: "70% FTSE All-World, 30% TLV-125, קרן כספית buffer"

---

## 2. Contradictory risk → scenario-based resolution

**Rule:** When risk signals contradict, use a concrete loss scenario (A/B/C) to discover real tolerance rather than guessing or refusing. Portfolio defaults are asked after contradiction is resolved.

**Scenario:** "I want maximum returns but I can't afford to lose any money" — resolved to moderate via scenario.

**Extracted:** amount: 45000 | age: 33 | risk: moderate | timeline: ~5 years | investmentPreferences: "MSCI World, קרן כספית"

---

## 3. Out-of-scope stock picking → ETF redirect

**Rule:** Individual stock picking is out of scope. Deliver a redirect-only message first (no data collection questions in the same turn) — explain why: buying a single stock concentrates all risk in one company, whereas a diversified ETF spreads that risk across hundreds of companies. Offer a sector ETF as a middle ground if the user has a sector preference. Begin field collection only once the user accepts. Portfolio defaults are asked after all fields are collected.

**Scenario:** "Should I buy NVIDIA stock?" — user accepts ETF approach with US tech tilt.

**Extracted:** amount: 30000 | age: 29 | risk: moderate | timeline: ~10 years | goal: reflects ETF-based investing | investmentPreferences: "70% S&P 500 + 30% NASDAQ, קרן כספית buffer"

---

## 4. Stated equity in goal → equity defaults skipped, buffer still asked

**Rule:** If an equity preference is already stated in the goal (e.g., a specific index, sector, or market), the equity sub-question of the portfolio defaults is skipped — the stage does not ask twice. The buffer sub-question is still asked if the user has not already addressed it, since buffer is a separate concern from equity allocation.

**Scenario:** "I have ₪100,000 and I want to invest in tech sector ETFs" — preference stated upfront, stage asks buffer only, user accepts קרן כספית.

**Extracted:** amount: 100000 | age: 31 | risk: moderate | timeline: ~15 years | investmentPreferences: "tech sector ETFs, קרן כספית buffer"

---

## 5. Multiple instruments without split → split required

**Rule:** If the user names two or more instruments without specifying percentages, ask for the split before treating `investmentPreferences` as complete. Ask only for the split — do not bundle it with other questions.

**Scenario:** "I want to invest in S&P 500 and TLV-125" — stage asks for split, user provides 70/30.

**Extracted:** amount: 100000 | age: 31 | risk: moderate | timeline: ~15 years | investmentPreferences: "70% S&P 500, 30% TLV-125, קרן כספית buffer"

---

## 6. 100% single-index concentration → valid, captured as-is

**Rule:** 100% concentration in a single index is a valid answer to the portfolio defaults question. The stage does not push back or suggest diversification.

**Scenario:** ₪80,000, intermediate, aggressive — user chooses 100% NASDAQ.

**Extracted:** amount: 80000 | age: 32 | risk: aggressive | timeline: ~15 years | investmentPreferences: "100% NASDAQ, קרן כספית buffer"

---

## 7. Advanced user → explanation depth matched, portfolio defaults still asked

**Rule:** When the user signals investing experience, match explanation depth to their level — skip introductory explanations and engage directly on specifics. Portfolio defaults are still asked if no preference has been stated; mentioning knowledge of an instrument (e.g., Irish ETFs) is not the same as expressing a preference to invest in it.

**Scenario:** "I have ₪200,000 to invest, I already know the basics" — user mentions Irish ETF knowledge; stage still asks portfolio defaults.

**Extracted:** amount: 200000 | age: 34 | risk: moderate | timeline: 20+ years | investmentPreferences: "80% MSCI World, 20% TLV-125, קרן כספית buffer"

---

## 8. Unrealistic expectations → redirect to realistic plan

**Rule:** When the user states an unrealistic financial goal (e.g., doubling capital in 6 months), redirect honestly — explain why it's not achievable, ask if they want to proceed with a realistic long-term plan, then collect the profile as normal. Once the user accepts, treat the redirect as complete and do not ask about the original goal again.

**Scenario:** "I have ₪18,000 and I want to double it in 6 months" — user pivots to 10-15 years.

**Extracted:** amount: 18000 | age: 24 | risk: moderate | timeline: 10-15 years | investmentPreferences: "100% S&P 500 — no buffer; emergency fund held separately outside portfolio"

---

## 9. User declines buffer → 100% equity accepted, no-buffer intent captured

**Rule:** If the user explicitly declines the buffer — for example, because they already hold an emergency fund outside this portfolio — accept that as a complete answer. Do not push back or suggest adding a buffer. The no-buffer intent must be captured in `investmentPreferences`.

**Scenario:** Young investor (26) with an emergency fund held separately in a קרן כספית outside the portfolio. Wants 100% S&P 500 with no in-portfolio buffer.

**Extracted:** amount: 25000 | age: 26 | risk: aggressive | hasEmergencyFund: true | investmentPreferences: "100% S&P 500 — no buffer; emergency fund held separately outside portfolio"

---

## 10. Passive calm holder → aggressive

**Rule:** When the user expresses no meaningful discomfort during a drop scenario — no stress, no sell intent, calm passive hold — extract `aggressive`. The absence of discomfort is itself the signal; buying-on-dips is not required to reach `aggressive`.

**Scenario:** User says "I'd hold and not worry about it — drops don't stress me, I'm in it for the long run." No mention of buying more.

**Extracted:** riskTolerance: aggressive

---

## 11. Short timeline + no directional behavioral signal → conservative (secondary signal)

**Rule:** When the user gives no directional behavioral signal (e.g. "I've never been through a market drop — I genuinely don't know what I'd do"), use `timeline` as a secondary corroborating signal. A timeline of ≤5 years leans conservative — there is insufficient time to recover from a significant downturn. Note: any statement containing a behavioral direction (hold/sell/buy), even with uncertainty qualifiers, is treated as that direction, not as directionless (see Rule 15).

**Scenario:** User has a 5-year timeline and says "I've never experienced a market drop — I honestly don't know what I'd do."

**Extracted:** riskTolerance: conservative

---

## 12. No emergency fund + no directional behavioral signal → conservative (secondary signal)

**Rule:** When the user gives no directional behavioral signal (genuinely "I don't know") and `hasEmergencyFund` is `false`, lean conservative. Without a financial buffer, the user is vulnerable to forced selling during a downturn regardless of stated intent.

**Scenario:** User says "Hard to say — I've never invested before, no idea how I'd react to a big drop", has no emergency fund.

**Extracted:** riskTolerance: conservative

---

## 13. High-concentration investment preference corroborates aggressive

**Rule:** When the user has chosen a high-concentration, high-volatility allocation (e.g. 100% NASDAQ) and the behavioral signal is borderline (e.g. "I think I'd be fine"), treat the preference as a corroborating signal toward `aggressive` — choosing 100% NASDAQ reveals risk appetite.

**Scenario:** User says "I'd probably be fine with drops, wouldn't panic" and has chosen 100% NASDAQ.

**Extracted:** riskTolerance: aggressive

---

## 14. Multiple conservative secondary signals compound → conservative

**Rule:** When the behavioral signal is ambiguous and multiple secondary signals all point conservative (e.g. short timeline + no emergency fund), extract `conservative` with high confidence — the signals compound.

**Scenario:** User has a 4-year timeline, no emergency fund, says "I've never invested before — no idea what I'd do."

**Extracted:** riskTolerance: conservative

---

## 15. Clear primary behavioral signal overrides secondary signals

**Rule:** When the concrete A/B/C scenario produced a clear behavioral answer, secondary signals (timeline, investmentPreferences, hasEmergencyFund) do not override it. Primary signal dominates.

**Scenario:** User answered "C — I'd stay calm and probably buy more" on the drop scenario, but has no emergency fund and a 4-year timeline.

**Extracted:** riskTolerance: aggressive (clear primary signal; secondary signals do not override)
