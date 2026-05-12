# Eval Last Run
Timestamp: 2026-05-12T08:30:55.900Z | Commit: 1905b54

---

## ✓ should re-ask amount when answer is vague

**Agent:** How much do you want to invest?

**User:** around 20-30k

**Agent:** You mentioned a range (20–30k). What exact amount in shekels would you like to invest?

**User:** ₪25,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 10+ years

**Output:**
status: completed | amount: 25000 | timeline: 10+ years


---

## ✓ should accept k-notation amounts

**Agent:** How much do you want to invest?

**User:** 50k

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 5-10 years

**Output:**
status: completed | amount: 50000 | timeline: 5–10 years


---

## ✓ should return failure when amount is never provided

**Agent:** How much do you want to invest?

**User:** I'm not sure yet

**Agent:** No worries—what specific amount in shekels do you want to invest? Please share a number (e.g., 10000).

**User:** I really don't know

**Output:**
status: unresolved | reason: amount


---

## ✓ should map approximate timeframe phrasing to correct bucket

**Agent:** How much do you want to invest?

**User:** ₪30,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** about 20 years

**Output:**
status: completed | amount: 30000 | timeline: 10+ years


---

## ✓ should present the four timeline bucket options when asking for timeline

**Agent:** How much do you want to invest?

**User:** ₪50,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 5-10 years

**Output:**
status: completed | amount: 50000 | timeline: 5–10 years


---

## ✓ should map exactly '3 years' to ''under 3 years''

**Agent:** How much do you want to invest?

**User:** ₪20,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 3 years

**Output:**
status: completed | amount: 20000 | timeline: under 3 years


---

## ✓ should map exactly '5 years' to ''3–5 years''

**Agent:** How much do you want to invest?

**User:** ₪20,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 5 years

**Output:**
status: completed | amount: 20000 | timeline: 3–5 years


---

## ✓ should map exactly '10 years' to ''5–10 years''

**Agent:** How much do you want to invest?

**User:** ₪20,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 10 years

**Output:**
status: completed | amount: 20000 | timeline: 5–10 years


---

## ✓ should re-ask timeline when vague

**Agent:** How much do you want to invest?

**User:** ₪20,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** long-term

**Agent:** “Long-term” can mean different things—could you choose one of these: under 3 years, 3–5 years, 5–10 years, or 10+ years?

**User:** I think 10-15 years

**Output:**
status: completed | amount: 20000 | timeline: 10+ years


---

## ✓ should return failure when timeline is never provided

**Agent:** How much do you want to invest?

**User:** ₪40,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** I have no idea

**Agent:** No worries—roughly, how long do you expect to keep investing (even if it’s an estimate)? Please choose one: under 3 years, 3–5 years, 5–10 years, or 10+ years.

**User:** I really can't say

**Output:**
status: unresolved | reason: timeline


---

## ✓ should redirect when user deflects the timeline question

**Agent:** How much do you want to invest?

**User:** ₪30,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** skip

**Agent:** No problem—just to place your risk level, which option fits your plan best: under 3 years, 3–5 years, 5–10 years, or 10+ years?

**User:** 5-10 years

**Output:**
status: completed | amount: 30000 | timeline: 5–10 years


---

## ✓ should redirect when user deflects the amount question

**Agent:** How much do you want to invest?

**User:** skip

**Agent:** Let’s set your investment plan—what amount in shekels would you like to invest?

**User:** ₪30,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 5-10 years

**Output:**
status: completed | amount: 30000 | timeline: 5–10 years


---

## ✓ should answer briefly then re-ask amount when user asks a clarifying question

**Agent:** How much do you want to invest?

**User:** why do you need to know?

**Agent:** I need the amount to build your investment plan. Could you share a specific number in shekels (₪)?

**User:** ₪30,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 5-10 years

**Output:**
status: completed | amount: 30000 | timeline: 5–10 years


---

## ✓ should answer briefly then re-ask timeline when user asks a clarifying question

**Agent:** How much do you want to invest?

**User:** ₪30,000

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** why does this matter?

**Agent:** Your timeline affects how much short-term risk and price volatility you can handle. Could you share roughly how many years you plan to invest (under 3 years, 3–5 years, 5–10 years, or 10+ years)?

**User:** 5-10 years

**Output:**
status: completed | amount: 30000 | timeline: 5–10 years

