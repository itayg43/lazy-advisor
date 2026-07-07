# Eval Last Run
Timestamp: 2026-07-07T14:30:39.137Z | Commit: bad1fe0

---

## ✓ should map approximate timeframe phrasing to correct bucket

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** about 20 years

**Output:**
status: completed | timeline: 10+ years


---

## ✓ should present the four timeline bucket options when asking for timeline

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 5-10 years

**Output:**
status: completed | timeline: 5–10 years


---

## ✓ should map exactly '3 years' to 'under 3 years'

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 3 years

**Output:**
status: completed | timeline: under 3 years


---

## ✓ should map exactly '5 years' to '3–5 years'

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 5 years

**Output:**
status: completed | timeline: 3–5 years


---

## ✓ should map exactly '10 years' to '5–10 years'

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** 10 years

**Output:**
status: completed | timeline: 5–10 years


---

## ✓ should re-ask timeline when vague

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** long-term

**Agent:** “Long-term” can mean different things—could you choose one of these: under 3 years, 3–5 years, 5–10 years, or 10+ years?

**User:** I think 10-15 years

**Output:**
status: completed | timeline: 10+ years


---

## ✓ should return failure when timeline is never provided

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** I have no idea

**Agent:** No problem—could you pick the closest option: under 3 years, 3–5 years, 5–10 years, or 10+ years? If you’re unsure, even a rough guess is fine.

**User:** I really can't say

**Output:**
status: unresolved | reason: timeline


---

## ✓ should redirect when user deflects the timeline question

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** skip

**Agent:** It looks like you want to skip this—could you share your investment timeline roughly (pick one: under 3 years, 3–5 years, 5–10 years, or 10+ years) so I can tailor recommendations?

**User:** 5-10 years

**Output:**
status: completed | timeline: 5–10 years


---

## ✓ should answer briefly then re-ask timeline when user asks a clarifying question

**Agent:** What's your investment timeline — `under 3 years`, `3–5 years`, `5–10 years`, `10+ years`?

**User:** why does this matter?

**Agent:** Your timeline determines how much risk your portfolio can absorb. Could you share roughly how many years you plan to invest—under 3 years, 3–5 years, 5–10 years, or 10+ years?

**User:** 5-10 years

**Output:**
status: completed | timeline: 5–10 years

