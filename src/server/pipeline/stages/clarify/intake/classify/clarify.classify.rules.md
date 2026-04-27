# Clarify Classify Phase — Behavior Rules

Behavioral rules for the goal classifier. Each entry: the rule, a one-line scenario, and the expected classification.

---

## 1. Individual stock picking, day trading, or direct crypto purchases → `out_of_scope`

**Rule:** A goal focused on buying individual stocks, day trading, or purchasing crypto directly (not via ETF) is classified as `out_of_scope`.

**Scenarios:** "Should I buy NVIDIA stock?" → `out_of_scope` | "I want to do day trading with ₪20,000" → `out_of_scope` | "I want to buy Bitcoin with ₪15,000" → `out_of_scope`

---

## 2. Unrealistic return expectations for passive ETF investing → `unrealistic`

**Rule:** A goal that states a return expectation unrealistic for passive ETF investing (e.g., doubling capital in months) is classified as `unrealistic`.

**Scenario:** "I have ₪18,000 and I want to double it in 6 months" → `unrealistic`

---

## 3. Contradictory risk signals in the goal → `contradictory`

**Rule:** A goal that explicitly states conflicting risk signals (e.g., maximum returns AND no losses) is classified as `contradictory`.

**Scenario:** "I want maximum returns but I can't afford to lose any money" → `contradictory`

---

## 4. Everything else → `normal`; when in doubt, classify as `normal`

**Rule:** All other goals pass through as `normal`, including vague goals, crypto ETFs, and goals with sector preferences. Crypto ETFs (e.g., IBIT) are valid aggressive preferences — only direct crypto purchases are `out_of_scope`. When in doubt, classify as `normal`.

**Scenarios:** "I want to start investing" → `normal` | "I want to invest in a Bitcoin ETF like IBIT" → `normal` | "I'm 35, ₪75,000, moderate risk, long-term retirement savings" → `normal`
