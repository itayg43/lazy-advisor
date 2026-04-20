# Clarify Stage — Behavior Rules

Behavioral rules for the clarify stage. Covers intake routing, fields, and preferences phases — ordered by execution sequence. Risk and contribution phases have dedicated rules files co-located with their implementations.

---

## 1. Out-of-scope stock picking → ETF redirect

**Rule:** Individual stock picking is out of scope. Deliver a redirect-only message first (no data collection questions in the same turn) — explain why: buying a single stock concentrates all risk in one company, whereas a diversified ETF spreads that risk across hundreds of companies. Offer a sector ETF as a middle ground if the user has a sector preference. Begin field collection only once the user accepts. Portfolio defaults are asked after all fields are collected.

**Scenario:** "Should I buy NVIDIA stock?" — user accepts ETF approach with US tech tilt.

**Extracted:** amount: 30000 | age: 29 | risk: moderate | timeline: ~10 years | goal: reflects ETF-based investing | investmentPreferences: "70% S&P 500 + 30% NASDAQ, קרן כספית buffer"

---

## 2. Unrealistic expectations → redirect to realistic plan

**Rule:** When the user states an unrealistic financial goal (e.g., doubling capital in 6 months), redirect honestly — explain why it's not achievable, ask if they want to proceed with a realistic long-term plan, then collect the profile as normal. Once the user accepts, treat the redirect as complete and do not ask about the original goal again.

**Scenario:** "I have ₪18,000 and I want to double it in 6 months" — user pivots to 10-15 years.

**Extracted:** amount: 18000 | age: 24 | risk: moderate | timeline: 10-15 years | investmentPreferences: "100% S&P 500 — no buffer; emergency fund held separately outside portfolio"

---

## 3. Advanced user → explanation depth matched, portfolio defaults still asked

**Rule:** When the user signals investing experience, match explanation depth to their level — skip introductory explanations and engage directly on specifics. Portfolio defaults are still asked if no preference has been stated; mentioning knowledge of an instrument (e.g., Irish ETFs) is not the same as expressing a preference to invest in it.

**Scenario:** "I have ₪200,000 to invest, I already know the basics" — user mentions Irish ETF knowledge; stage still asks portfolio defaults.

**Extracted:** amount: 200000 | age: 34 | risk: moderate | timeline: 20+ years | investmentPreferences: "80% MSCI World, 20% TLV-125, קרן כספית buffer"

---

## 4. Contradictory risk → scenario-based resolution

**Rule:** When risk signals contradict, use a concrete loss scenario (A/B/C) to discover real tolerance rather than guessing or refusing. Portfolio defaults are asked after contradiction is resolved.

**Scenario:** "I want maximum returns but I can't afford to lose any money" — resolved to moderate via scenario.

**Extracted:** amount: 45000 | age: 33 | risk: moderate | timeline: ~5 years | investmentPreferences: "MSCI World, קרן כספית"

---

## 5. Complete beginner, no preferences → portfolio defaults flow

**Rule:** When no investment preference has been stated after all required fields are collected, ask the portfolio defaults question — equity allocation options with compound projections, and a קרן כספית suggestion for the buffer. This applies to all users regardless of knowledge level.

**Scenario:** ₪55,000, beginner, no preferences stated.

**Extracted:** amount: 55000 | age: 28 | risk: moderate | timeline: ~20 years | investmentPreferences: "70% FTSE All-World, 30% TLV-125, קרן כספית buffer"

---

## 6. Stated equity in goal → equity defaults skipped, buffer still asked

**Rule:** If an equity preference is already stated in the goal (e.g., a specific index, sector, or market), the equity sub-question of the portfolio defaults is skipped — the stage does not ask twice. The buffer sub-question is still asked if the user has not already addressed it, since buffer is a separate concern from equity allocation.

**Scenario:** "I have ₪100,000 and I want to invest in tech sector ETFs" — preference stated upfront, stage asks buffer only, user accepts קרן כספית.

**Extracted:** amount: 100000 | age: 31 | risk: moderate | timeline: ~15 years | investmentPreferences: "tech sector ETFs, קרן כספית buffer"

---

## 7. Multiple instruments without split → split required

**Rule:** If the user names two or more instruments without specifying percentages, ask for the split before treating `investmentPreferences` as complete. Ask only for the split — do not bundle it with other questions.

**Scenario:** "I want to invest in S&P 500 and TLV-125" — stage asks for split, user provides 70/30.

**Extracted:** amount: 100000 | age: 31 | risk: moderate | timeline: ~15 years | investmentPreferences: "70% S&P 500, 30% TLV-125, קרן כספית buffer"

---

## 8. 100% single-index concentration → valid, captured as-is

**Rule:** 100% concentration in a single index is a valid answer to the portfolio defaults question. The stage does not push back or suggest diversification.

**Scenario:** ₪80,000, intermediate, aggressive — user chooses 100% NASDAQ.

**Extracted:** amount: 80000 | age: 32 | risk: aggressive | timeline: ~15 years | investmentPreferences: "100% NASDAQ, קרן כספית buffer"

---

## 9. User declines buffer → 100% equity accepted, no-buffer intent captured

**Rule:** If the user explicitly declines the buffer — for example, because they already hold an emergency fund outside this portfolio — accept that as a complete answer. Do not push back or suggest adding a buffer. The no-buffer intent must be captured in `investmentPreferences`.

**Scenario:** Young investor (26) with an emergency fund held separately in a קרן כספית outside the portfolio. Wants 100% S&P 500 with no in-portfolio buffer.

**Extracted:** amount: 25000 | age: 26 | risk: aggressive | hasEmergencyFund: true | investmentPreferences: "100% S&P 500 — no buffer; emergency fund held separately outside portfolio"

---

## Debugging Failing Evals

When an eval fails, check the `*.last-run.md` file alongside the eval before doing anything else. It contains the full transcript of what the model said and did — this is usually enough to diagnose the failure without rerunning.

Common failure patterns and how the transcript reveals them:

- **Overflow throw** (`no response scripted for turn N`): the transcript shows all turns up to the throw. Count the agent questions — the test has fewer scripted responses than the model asked for. Add the missing response.
- **Assertion failure**: the extracted profile is shown at the bottom. Check whether the assertion is too strict (e.g., the model chose `conservative` where `moderate` was expected and both are valid), or whether the model genuinely extracted the wrong value. Loosen the assertion or fix the prompt accordingly.
- **Stage error before transcript**: the last-run entry will be missing or empty. Look at the test's scripted responses — one may be an unexpected or nonsensical answer that caused the stage to error out.

After diagnosing, make the minimal fix (add a response, adjust an assertion, fix the prompt) and rerun the specific eval file to confirm.
