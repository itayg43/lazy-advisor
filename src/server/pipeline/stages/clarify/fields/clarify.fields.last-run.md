# Eval Last Run
Timestamp: 2026-04-28T07:27:52.961Z | Commit: a1402e1

---

## ✓ should collect all fields in exactly two turns

**Agent:** A few details to get started:
1. How much do you want to invest (a specific number)?
2. How old are you (in years)?
3. What’s your investment timeline? Choose one: `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`.

**User:** ₪30,000, I'm 27, 20 years

**Agent:** Two more quick questions:
1. Do you have an emergency fund set aside? (yes/no)
2. Do you have any debt you’re currently paying down? (yes/no)

**User:** Yes emergency fund, no debt

**Output:**
amount: 30000 | age: 27 | timeline: 10+ years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should re-ask timeline when vague before proceeding to EF/debt

**Agent:** A few details to get started:
1. How much do you want to invest (a specific number)?
2. How old are you?
3. What’s your investment timeline — 1) under 3 years  2) 3–5 years  3) 5–10 years  4) 10+ years

**User:** I have ₪20,000, I'm 32, long-term

**Agent:** Got it. Which of these best fits your investment timeline?
1) under 3 years
2) 3–5 years
3) 5–10 years
4) 10+ years

**User:** I guess maybe 10-15 years

**Agent:** Two more quick questions:
1. Do you have an emergency fund set aside? (yes/no)
2. Do you have any debt you’re currently paying down? (yes/no)

**User:** Yes emergency fund, no debt

**Output:**
amount: 20000 | age: 32 | timeline: 10+ years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should present the four timeline bucket options when asking for timeline

**Agent:** A few details to get started:
1. How much do you want to invest (a specific amount)?
2. How old are you?
3. What’s your investment timeline?
   - under 3 years
   - 3–5 years
   - 5–10 years
   - 10+ years

**User:** ₪50,000, I'm 25

**Agent:** Got it. What’s your investment timeline?
1. under 3 years
2. 3–5 years
3. 5–10 years
4. 10+ years

**User:** 5-10 years

**Agent:** Two more quick questions:
1. Do you have an emergency fund set aside? (yes/no)
2. Do you have any debt you’re currently paying down? (yes/no)

**User:** Yes I have an emergency fund, no debt

**Output:**
amount: 50000 | age: 25 | timeline: 5–10 years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should map a short stated timeframe to the 'under 3 years' bucket

**Agent:** A few details to get started:
1. How much do you want to invest (a specific amount)?
2. How old are you?
3. What’s your investment timeline? Choose one: `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`

**User:** ₪20,000, I'm 50, I need this money in about 2 years

**Agent:** Two more quick questions:
1. Do you have an emergency fund set aside? (yes/no)
2. Do you have any debt you’re currently paying down? (yes/no)

**User:** Yes emergency fund, no debt

**Output:**
amount: 20000 | age: 50 | timeline: under 3 years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should map a medium stated timeframe to the '3–5 years' bucket

**Agent:** A few details to get started:
1. How much do you want to invest (a specific amount)?
2. How old are you?
3. What’s your investment timeline?
   1) under 3 years
   2) 3–5 years
   3) 5–10 years
   4) 10+ years

**User:** ₪25,000, I'm 45, about 4-year horizon

**Agent:** Two more quick questions:
1. Do you have an emergency fund set aside? (yes/no)
2. Do you have any debt you're currently paying down? (yes/no)

**User:** Yes emergency fund, no debt

**Output:**
amount: 25000 | age: 45 | timeline: 3–5 years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should map exactly 3 years to the 'under 3 years' bucket

**Agent:** A few details to get started:
1. How much do you want to invest? (please provide a specific amount)
2. How old are you? (number)
3. What’s your investment timeline? Choose one: `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`

**User:** ₪20,000, I'm 30, 3 years

**Agent:** Two more quick questions:
1. Do you have an emergency fund set aside? (yes/no)
2. Do you have any debt you’re currently paying down? (yes/no)

**User:** Yes emergency fund, no debt

**Output:**
amount: 20000 | age: 30 | timeline: under 3 years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should map exactly 5 years to the '3–5 years' bucket

**Agent:** A few details to get started:
1. How much do you want to invest (a specific number)?
2. How old are you? 
3. What’s your investment timeline — choose one: `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`.

**User:** ₪20,000, I'm 30, 5 years

**Agent:** Two more quick questions:
1. Do you have an emergency fund set aside? (yes/no)
2. Do you have any debt you’re currently paying down? (yes/no)

**User:** Yes emergency fund, no debt

**Output:**
amount: 20000 | age: 30 | timeline: 3–5 years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should map exactly 10 years to the '5–10 years' bucket

**Agent:** A few details to get started:
1. How much do you want to invest (a specific amount)?
2. How old are you?
3. What’s your investment timeline — choose one: `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`.

**User:** ₪20,000, I'm 30, 10 years

**Agent:** Two more quick questions:
1. Do you have an emergency fund set aside? (yes/no)
2. Do you have any debt you're currently paying down? (yes/no)

**User:** Yes emergency fund, no debt

**Output:**
amount: 20000 | age: 30 | timeline: 5–10 years | hasEmergencyFund: true | hasDebt: false

