# Eval Last Run
Timestamp: 2026-05-09T00:16:57.855Z | Commit: 6340346

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

**Agent:** How much do you want to invest?

**User:** ₪20,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** long-term

**Agent:** Could you pick one from these options: under 3 years, 3–5 years, 5–10 years, or 10+ years?

**User:** I think 10-15 years

**Output:**
status: success | amount: 20000 | timeline: 10+ years


---

## ✓ should return failure when timeline is never provided

**Agent:** How much do you want to invest?

**User:** ₪40,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** I have no idea

**Agent:** No worries—could you pick the closest option for your timeline: under 3 years, 3–5 years, 5–10 years, or 10+ years?

**User:** I really can't say

**Output:**
status: failure | code: timeline_missing


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

## ✓ should re-ask amount when answer is vague

**Agent:** How much do you want to invest?

**User:** around 20-30k

**Agent:** What exact amount in shekels do you want to invest—e.g., ₪20000 or ₪30000?

**User:** ₪25,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 10+ years

**Output:**
status: success | amount: 25000 | timeline: 10+ years


---

## ✓ should redirect when user deflects the timeline question

**Agent:** How much do you want to invest?

**User:** ₪30,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** skip

**Agent:** I need your timeline to continue—could you pick one: under 3 years, 3–5 years, 5–10 years, or 10+ years?

**User:** 5-10 years

**Output:**
status: success | amount: 30000 | timeline: 5–10 years


---

## ✓ should accept k-notation amounts

**Agent:** How much do you want to invest?

**User:** 50k

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 5-10 years

**Output:**
status: success | amount: 50000 | timeline: 5–10 years


---

## ✓ should return failure when amount is never provided

**Agent:** How much do you want to invest?

**User:** I'm not sure yet

**Agent:** Could you give me a specific amount you want to invest in shekels?

**User:** I really don't know

**Output:**
status: failure | code: amount_missing

