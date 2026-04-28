# Eval Last Run
Timestamp: 2026-04-28T17:07:10.038Z | Commit: 8f023e1

---

## ✓ should classify individual stock picking as out_of_scope

**Goal:** "Should I buy NVIDIA stock?"

**Output:**
classification: out_of_scope


---

## ✓ should classify day trading as out_of_scope

**Goal:** "I want to do day trading with ₪20,000"

**Output:**
classification: out_of_scope


---

## ✓ should classify direct crypto purchase as out_of_scope

**Goal:** "I want to buy Bitcoin with ₪15,000"

**Output:**
classification: out_of_scope


---

## ✓ should classify a mixed ETF-and-stock goal as out_of_scope

**Goal:** "I want to invest in ETFs but also buy some NVIDIA stock"

**Output:**
classification: out_of_scope


---

## ✓ should classify doubling capital in 6 months as unrealistic

**Goal:** "I have ₪18,000 and I want to double it in 6 months"

**Output:**
classification: unrealistic


---

## ✓ should classify conflicting risk signals as contradictory

**Goal:** "I want maximum returns but I can't afford to lose any money"

**Output:**
classification: contradictory


---

## ✓ should classify a vague goal as normal

**Goal:** "I want to start investing"

**Output:**
classification: normal


---

## ✓ should classify a crypto ETF goal as normal

**Goal:** "I want to invest in a Bitcoin ETF like IBIT"

**Output:**
classification: normal


---

## ✓ should classify a rich goal as normal

**Goal:** "I'm 35, I have ₪75,000, moderate risk, long-term retirement savings"

**Output:**
classification: normal


---

## ✓ should classify a sector-only ETF goal as normal

**Goal:** "I want to invest in real estate ETFs"

**Output:**
classification: normal

