# Eval Last Run
Timestamp: 2026-04-17T02:14:27.925Z | Commit: ec1048d

---

## ✓ should return output immediately when all fields are present in the goal

**Goal:** "I'm 24, ₪18,000, 10 years, yes emergency fund, no debt, yes I plan to add money regularly"

**Output:**
goal: Invest ₪18,000 over 10 years (no additional constraints stated) | amount: 18000 | age: 24 | timeline: 10 years | hasEmergencyFund: true | hasDebt: false | plansToContribute: true


---

## ✓ should stop probing timeline after 2 asks and accept best available answer

**Goal:** "I want to invest"

**Agent:** A few details to get started:
1. How much do you want to invest (a specific amount)?
2. How old are you?
3. What's your investment timeline — how many years, or until a specific milestone?
4. Do you have an emergency fund set aside? (yes/no)

**User:** I have ₪20,000, I'm 32, long-term

**Agent:** Got it. A few quick questions to finish:
1. When you say long-term, about how many years are you thinking?
2. Do you have an emergency fund set aside? (yes/no)
3. Do you currently have any debt you’re paying down? (yes/no)
4. Investing regularly — even small amounts — lets you buy more units over time and smooths out market fluctuations. Do you plan to add money to your portfolio periodically? (yes/no)

**User:** I guess maybe 10-15 years. yes emergency fund, no debt, yes I plan to contribute

**Output:**
goal: Invest for the long term | amount: 20000 | age: 32 | timeline: 10-15 years | hasEmergencyFund: true | hasDebt: false | plansToContribute: true


---

## ✓ should ask only for gaps when goal already contains several fields

**Goal:** "I'm 35, ₪75,000, long-term retirement savings"

**Agent:** A few details to get started:
1. How many years are you thinking for this retirement investing, or until what age do you plan to retire?
2. Do you have an emergency fund set aside? (yes/no)
3. Do you currently have any debt you’re paying down? (yes/no)
4. Investing regularly — even small amounts — lets you buy more units over time and smooths out market fluctuations. Do you plan to add money to your portfolio periodically? (yes/no)

**User:** About 30 years — I'll retire at 65

**Agent:** Quick follow-ups:
1. Do you have an emergency fund set aside? (yes/no)
2. Do you currently have any debt you’re paying down? (yes/no)
3. Do you plan to add money to your portfolio periodically? (yes/no)

**User:** Yes emergency fund, no debt, yes I plan to add money periodically

**Output:**
goal: Long-term retirement savings | amount: 75000 | age: 35 | timeline: About 30 years — retire at 65 | hasEmergencyFund: true | hasDebt: false | plansToContribute: true


---

## ✓ should accept plansToContribute as false when user explicitly declines

**Goal:** "I have ₪40,000, I'm 28, 15 years, yes emergency fund, no debt, no I won't be adding money"

**Output:**
goal: Invest ₪40,000 for 15 years (user will not be adding more money). | amount: 40000 | age: 28 | timeline: 15 years | hasEmergencyFund: true | hasDebt: false | plansToContribute: false


---

## ✓ should default plansToContribute to false after a vague answer

**Goal:** "I want to invest ₪40,000, I'm 28, 15 years, yes emergency fund, no debt"

**Agent:** 1. Investing regularly — even small amounts — lets you buy more units over time and smooths out market fluctuations. Do you plan to add money to your portfolio periodically? (yes/no)

**User:** I'm not sure, maybe someday but not regularly

**Output:**
goal: Invest ₪40,000 for 15-year timeframe; general investment goal with emergency fund in place and no debt. | amount: 40000 | age: 28 | timeline: 15 years | hasEmergencyFund: true | hasDebt: false | plansToContribute: false


---

## ✓ should ask at most 4 questions in the first turn when many fields are missing

**Goal:** "I want to start investing"

**Agent:** A few details to get started:
1. How much do you want to invest (a specific amount)?
2. How old are you?
3. What's your investment timeline — how many years, or until a specific milestone?
4. Do you have an emergency fund set aside? (yes/no)

**User:** ₪30,000, I'm 27, 20 years, yes emergency fund

**Agent:** 1. Do you currently have any debt you’re paying down? (yes/no)
2. Investing regularly — even small amounts — lets you buy more units over time and smooths out market fluctuations. Do you plan to add money to your portfolio periodically? (yes/no)

**User:** No debt, yes I plan to add money regularly

**Output:**
goal: Start investing with ₪30,000, for a long-term plan of 20 years (no other purpose/constraints stated). | amount: 30000 | age: 27 | timeline: 20 years | hasEmergencyFund: true | hasDebt: false | plansToContribute: true

