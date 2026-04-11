# Research Stage — Behavior Examples

Scenarios organized by behavior rule. Scenarios 1–4 cover allocation logic (input: user profile → output: allocation plan). Scenarios 5–6 cover extraction (input: research text → output: structured summary).

---

## 1. Young moderate investor — bond allocation reduced

**Rule:** Young investors (≤50) with an emergency fund → bond/defensive allocation ≤ 20%. The emergency fund replaces the capital-preservation role of bonds for working-age investors.

**Profile:** amount: 55000 | age: 28 | risk: moderate | timeline: 20 years | hasEmergencyFund: true | hasDebt: false | monthlyContribution: 1800 | brokerage: none | knowledgeLevel: beginner | investmentPreferences: none

**Expected allocation:** Total bond/defensive slice (any combination of money market, שחר, אגח, fixed income, קרן כספית) ≤ 20%. Equity slice(s) make up ≥ 80%.

---

## 2. Young aggressive investor — bonds minimal or absent

**Rule:** Young investors (≤50) with aggressive risk and an emergency fund → bond/defensive allocation ≤ 10%. Aggressive risk + long horizon + emergency fund = equity-heavy portfolio.

**Profile:** amount: 35000 | age: 25 | risk: aggressive | timeline: 20+ years | hasEmergencyFund: true | hasDebt: false | monthlyContribution: 1500 | brokerage: none | knowledgeLevel: beginner | investmentPreferences: none

**Expected allocation:** Total bond/defensive slice ≤ 10%. May be 0%.

---

## 3. Older investor — bonds required regardless of emergency fund

**Rule:** Investors over 50 must have bonds/defensive allocation regardless of emergency fund status. Proximity to retirement requires capital preservation.

**Profile:** amount: 200000 | age: 58 | risk: conservative | timeline: 10 years | hasEmergencyFund: true | hasDebt: false | monthlyContribution: 3000 | brokerage: none | knowledgeLevel: intermediate | investmentPreferences: none

**Expected allocation:** Total bond/defensive slice > 0%. Emergency fund does not exempt older investors from holding defensive assets.

---

## 4. Explicit preferences with percentages → exact allocation slices

**Rule:** When `investmentPreferences` contains instruments with explicit percentages (e.g., "80% S&P 500, 20% TLV-125"), the allocation plan must create dedicated slices at those exact percentages. The LLM must not reinterpret or adjust the stated split.

**Profile:** amount: 100000 | age: 32 | risk: moderate | timeline: 15 years | hasEmergencyFund: true | hasDebt: false | monthlyContribution: 2500 | brokerage: none | knowledgeLevel: intermediate | investmentPreferences: "80% S&P 500, 20% TLV-125"

**Expected allocation:** S&P 500 slice = 80% exactly. TLV-125 slice = 20% exactly. No bond slice added on top — percentages sum to 100%.

---

## 5. ETF extraction — full detail

**Rule:** The extraction phase must capture `ticker`, `expenseRatio`, and `trackingIndex` for each ETF from the research text. Category names and percentages must match the allocation plan exactly.

**Research text (abbreviated):**
```
Allocation plan:
- Global Equities (FTSE All-World): 60%
- Israeli S&P 500 Index Funds (קרנות מחקות): 20%
- קרן כספית (Israeli Money Market): 20%

VWRA — Vanguard FTSE All-World UCITS ETF. Tracks FTSE All-World. Expense ratio: 0.22%.
1159235 — Harel S&P 500 Tracking Fund. Tracks S&P 500. Annual management fee: 0.25%.
5122505 — Migdal Money Market Fund. Annual management fee: 0.03%.
```

**Expected extraction:**
- Category "Global Equities" at 60%: VWRA | expenseRatio: 0.22 | trackingIndex: "FTSE All-World"
- Category "Israeli S&P 500" at 20%: 1159235 | expenseRatio: 0.25 | trackingIndex: "S&P 500"
- Category "קרן כספית" at 20%: 5122505 | expenseRatio: 0.03 | trackingIndex: any valid value

---

## 6. ETF extraction — missing tracking index defaults to "none"

**Rule:** When the research text does not mention a tracking index for a thematic or non-index ETF, `trackingIndex` must be extracted as the string `"none"`. The model must not guess or fabricate a tracking index.

**Research text (abbreviated):**
```
## Technology & Automation — 10%
SXRV — iShares Automation & Robotics UCITS ETF.
Thematic fund investing in automation, robotics, and AI companies. Expense ratio: 0.40%.
```

**Expected extraction:** SXRV | expenseRatio: 0.40 | trackingIndex: "none"
