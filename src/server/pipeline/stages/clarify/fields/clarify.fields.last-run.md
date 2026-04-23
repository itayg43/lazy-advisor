# Eval Last Run
Timestamp: 2026-04-23T01:39:04.973Z | Commit: d4f6c8f

---

## ✓ should ask only for gaps when goal includes amount and timeline

**Goal:** "I want to start investing, I have about ₪18,000 and a 7-year horizon"

**Agent:** Great—just a few quick details so I can proceed:
1. How old are you?
2. Do you have an emergency fund set aside? (yes/no)
3. Do you currently have any debt you’re paying down? (yes/no)

**User:** I'm 27, yes I have an emergency fund, no debt

**Output:**
amount: 18000 | age: 27 | timeline: 5–10 years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should ask only for gaps when goal already contains several fields

**Goal:** "I'm 35, ₪75,000, long-term retirement savings"

**Agent:** A couple quick details:
1. Which of these best fits your investment timeline?
   1) under 3 years
   2) 3–5 years
   3) 5–10 years
   4) 10+ years
2. Do you have an emergency fund set aside? (yes/no)
3. Do you currently have any debt you’re paying down? (yes/no)

**User:** About 30 years — I'll retire at 65

**Agent:** Thanks—2 quick yes/no questions:
1. Do you have an emergency fund set aside? (yes/no)
2. Do you currently have any debt you’re paying down? (yes/no)

**User:** Yes emergency fund, no debt

**Output:**
amount: 75000 | age: 35 | timeline: 10+ years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should ask at most 4 questions in the first turn when many fields are missing

**Goal:** "I want to start investing"

**Agent:** A few details to get started:
1. How much do you want to invest (a specific number)?
2. How old are you?
3. What’s your investment timeline?
   1) under 3 years
   2) 3–5 years
   3) 5–10 years
   4) 10+ years
4. Do you have an emergency fund set aside? (yes/no)

**User:** ₪30,000, I'm 27, 20 years, yes emergency fund

**Agent:** Do you currently have any debt you’re paying down? (yes/no)

**User:** No debt

**Output:**
amount: 30000 | age: 27 | timeline: 10+ years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should stop probing timeline after 2 asks and accept best available answer

**Goal:** "I want to invest"

**Agent:** A few details to get started:
1. How much do you want to invest (a specific amount)?
2. How old are you?
3. What’s your investment timeline?
   1) under 3 years
   2) 3–5 years
   3) 5–10 years
   4) 10+ years
4. Do you have an emergency fund set aside? (yes/no)

**User:** I have ₪20,000, I'm 32, long-term

**Agent:** Which of these best fits your investment timeline?
1. under 3 years
2. 3–5 years
3. 5–10 years
4. 10+ years

1. Do you have an emergency fund set aside? (yes/no)
2. Do you currently have any debt you’re paying down? (yes/no)

**User:** I guess maybe 10-15 years. yes emergency fund, no debt

**Output:**
amount: 20000 | age: 32 | timeline: 10+ years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should present the four timeline bucket options when asking for timeline

**Goal:** "I want to invest ₪50,000, I'm 25"

**Agent:** A few quick details so I can set this up:
1. What’s your investment timeline (choose one)?
   1) under 3 years
   2) 3–5 years
   3) 5–10 years
   4) 10+ years
2. Do you have an emergency fund set aside? (yes/no)
3. Do you currently have any debt you’re paying down? (yes/no)

**User:** 5-10 years, yes I have an emergency fund, no debt

**Output:**
amount: 50000 | age: 25 | timeline: 5–10 years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should map a short stated timeframe to the 'under 3 years' bucket

**Goal:** "I want to invest ₪20,000, I'm 50, I'll need this money in about 2 years"

**Agent:** 1. Do you have an emergency fund set aside? (yes/no)
2. Do you currently have any debt you’re paying down? (yes/no)

**User:** Yes emergency fund, no debt

**Output:**
amount: 20000 | age: 50 | timeline: under 3 years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should map a medium stated timeframe to the '3–5 years' bucket

**Goal:** "I'm 45, ₪25,000 to invest, about 4-year horizon"

**Agent:** Quick checks:
1. Do you have an emergency fund set aside? (yes/no)
2. Do you currently have any debt you’re paying down? (yes/no)

**User:** Yes emergency fund, no debt

**Output:**
amount: 25000 | age: 45 | timeline: 3–5 years | hasEmergencyFund: true | hasDebt: false

