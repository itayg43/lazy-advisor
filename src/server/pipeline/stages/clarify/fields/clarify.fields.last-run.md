# Eval Last Run
Timestamp: 2026-04-22T22:49:10.162Z | Commit: 064bbc8

---

## ✓ should ask only for gaps when goal includes amount and timeline

**Goal:** "I want to start investing, I have about ₪18,000 and maybe 10 years"

**Agent:** A few quick details:
1. How old are you?
2. Can you confirm your timeline in years — is it about 10 years (yes/no or exact number)?
3. Do you already have an emergency fund set aside? (yes/no)
4. Do you currently have any debt you’re paying down? (yes/no)

**User:** I'm 27, yes I have an emergency fund, no debt

**Output:**
amount: 18000 | age: 27 | timeline: 10 years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should ask only for gaps when goal already contains several fields

**Goal:** "I'm 35, ₪75,000, long-term retirement savings"

**Agent:** A few details to get started:
1. For “long-term retirement savings,” roughly how many years is your timeline (or what age are you aiming to retire)?
2. Do you currently have an emergency fund set aside? (yes/no)
3. Do you currently have any debt you’re paying down? (yes/no)

**User:** About 30 years — I'll retire at 65

**Agent:** Got it—retire at 65. 
1. Do you currently have an emergency fund set aside? (yes/no)
2. Do you currently have any debt you’re paying down? (yes/no)

**User:** Yes emergency fund, no debt

**Output:**
amount: 75000 | age: 35 | timeline: retire at 65 | hasEmergencyFund: true | hasDebt: false


---

## ✓ should ask at most 4 questions in the first turn when many fields are missing

**Goal:** "I want to start investing"

**Agent:** A few details to get started:
1. How much do you want to invest (a specific number)?
2. How old are you?
3. What's your investment timeline — how many years (or until a specific milestone)?
4. Do you have an emergency fund set aside? (yes/no)

**User:** ₪30,000, I'm 27, 20 years, yes emergency fund

**Agent:** 1. Do you currently have any debt you’re paying down? (yes/no)

**User:** No debt

**Output:**
amount: 30000 | age: 27 | timeline: 20 years | hasEmergencyFund: true | hasDebt: false


---

## ✓ should stop probing timeline after 2 asks and accept best available answer

**Goal:** "I want to invest"

**Agent:** A few details to get started:
1. How much do you want to invest (a specific amount)?
2. How old are you?
3. What's your investment timeline — how many years, or until a specific milestone?
4. Do you have an emergency fund set aside? (yes/no)

**User:** I have ₪20,000, I'm 32, long-term

**Agent:** Got it. A couple quick specifics:
1. About how many years is your investing timeline? (e.g., 10 years, 20 years)
2. Do you have an emergency fund set aside? (yes/no)
3. Do you currently have any debt you’re paying down? (yes/no)

**User:** I guess maybe 10-15 years. yes emergency fund, no debt

**Output:**
amount: 20000 | age: 32 | timeline: 10-15 years | hasEmergencyFund: true | hasDebt: false

