# Eval Last Run
Timestamp: 2026-05-05T17:35:47.187Z | Commit: 2f07343

---

## ✓ should collect amount then timeline in separate questions

**Agent:** How much do you want to invest?

**User:** ₪30,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** about 20 years

**Output:**
status: success | amount: 30000 | timeline: 10+ years


---

## ✓ should re-ask timeline when vague

**Agent:** How much do you want to invest? (Please give a specific amount in shekels.)

**User:** ₪20,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** long-term

**Agent:** Which of these best fits your investment timeline?
1. under 3 years
2. 3–5 years
3. 5–10 years
4. 10+ years

**User:** I think 10-15 years

**Output:**
status: success | amount: 20000 | timeline: 10+ years


---

## ✓ should present the four timeline bucket options when asking for timeline

**Agent:** How much do you want to invest?

**User:** ₪50,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 5-10 years

**Output:**
status: success | amount: 50000 | timeline: 5–10 years


---

## ✓ should map exactly 3 years to 'under 3 years'

**Agent:** How much do you want to invest?

**User:** ₪20,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 3 years

**Output:**
status: success | amount: 20000 | timeline: under 3 years


---

## ✓ should map exactly 5 years to '3–5 years'

**Agent:** How much do you want to invest?

**User:** ₪20,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 5 years

**Output:**
status: success | amount: 20000 | timeline: 3–5 years


---

## ✓ should map exactly 10 years to '5–10 years'

**Agent:** How much do you want to invest?

**User:** ₪20,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 10 years

**Output:**
status: success | amount: 20000 | timeline: 5–10 years


---

## ✓ should return failure when amount is never provided

**Agent:** How much do you want to invest?

**User:** I'm not sure yet

**Agent:** Could you give me a specific amount in shekels?

**User:** I really don't know

**Output:**
status: failure | code: amount_missing

