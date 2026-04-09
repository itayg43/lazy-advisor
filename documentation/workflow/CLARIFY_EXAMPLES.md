# Clarify Stage — Behavior Examples

Scenarios organized by behavior rule. Each scenario has: the rule it demonstrates, the conversation, and what gets extracted.

---

## 1. Complete beginner, no preferences → portfolio defaults flow

**Rule:** When `investmentPreferences` would be "none", ask the portfolio defaults question before completing the stage — equity allocation options with compound projections, and a קרן כספית suggestion for the buffer.

**Goal:** "I have ₪55,000 and I want to start investing but I have no idea where to begin"

**Agent:** Great — you've got the amount. A few quick details so I can tailor the next step:
1. How old are you?
2. What country are you in?
3. When do you want to use this money (roughly how many years, or until what age/milestone)?
4. How would you describe your risk comfort — lower ups/downs (conservative), a mix (moderate), or okay with bigger swings for higher potential (aggressive)?
5. Do you already have an emergency fund saved?
6. Any outstanding debt you're paying regularly?
7. How much can you add each month (in ₪)?
8. What's your knowledge level about investing (beginner, intermediate, or advanced)?

**User:** I'm 28, yes 6 months of emergency savings, no debt, this is for long-term investing, a 20% drop would stress me but I wouldn't sell, I'm in Israel, about ₪1,800/mo. I'm a complete beginner.

**Agent:** Thanks — one last piece: when you say "long-term," roughly how many years is your timeline, or until what age/milestone?

**User:** I'd say about 20 years, maybe until I'm around 50.

**Agent:** Before I hand this off, two things to shape the approach:

1. What do you want your equity allocation to look like?
   - FTSE All-World (~10%/yr): widest diversification, includes emerging markets.
   - MSCI World (~11%/yr): developed markets only, no EM.
   - S&P 500 (~13%/yr): US concentrated.
   - NASDAQ-100 (~18%/yr): US tech-heavy, very volatile.
   - TLV-125 (~8%/yr in NIS): Israeli market, shekel-denominated.

   ₪55,000 over 20 years: at 10%/yr → ~₪370,000; at 13%/yr → ~₪634,000; at 18%/yr → ~₪1,200,000. Past returns don't guarantee future results. Any combination or split works.

2. For the non-equity buffer, I'd suggest a קרן כספית — shekel-denominated, ~4–5% yield, capital-stable. Does that work?

**User:** 70% FTSE All-World and 30% TLV-125. קרן כספית sounds right.

**Extracted:** amount: 55000 | age: 28 | risk: moderate | timeline: ~20 years | hasEmergencyFund: true | hasDebt: false | monthlyContribution: 1800 | brokerage: none | knowledgeLevel: beginner | investmentPreferences: "70% FTSE All-World, 30% TLV-125, קרן כספית buffer"

---

## 2. Vague timeline → accepted after second ask

**Rule:** If a field has been asked twice without a specific value, accept the best available answer and move on — do not probe a third time.

**Goal:** "I want to invest"

**Agent:** Happy to help. To get started, a few things:
1. How much do you have to invest?
2. How old are you?
3. What country are you in?
4. What's your timeline — roughly how many years, or until a milestone like retirement?
5. Risk tolerance — conservative, moderate, or aggressive?
6. Emergency fund? Any debt? Monthly contribution? Knowledge level? Brokerage?

**User:** I have ₪20,000, I'm 32, I'm in Israel, long-term.

**Agent:** Got most of it. When you say "long-term" — roughly how many years are you thinking, or until a specific age?

**User:** I guess maybe 10-15 years. Moderate risk, beginner, yes emergency fund, no debt, ₪800/mo, no brokerage.

**Agent:** *(proceeds to portfolio defaults question — stage does not ask about timeline again)*

**User:** 100% FTSE All-World. קרן כספית for the buffer.

**Extracted:** amount: 20000 | age: 32 | risk: moderate | timeline: "10-15 years" | hasEmergencyFund: true | hasDebt: false | monthlyContribution: 800 | brokerage: none | knowledgeLevel: beginner | investmentPreferences: "100% FTSE All-World, קרן כספית buffer"

---

## 3. Contradictory risk → scenario-based resolution

**Rule:** When risk signals contradict, use a concrete loss scenario (A/B/C) to discover real tolerance rather than guessing or refusing.

**Goal:** "I want maximum returns but I can't afford to lose any money"

**Agent:** Those two goals pull in opposite directions — higher returns always come with higher risk of loss. To understand your real comfort level: imagine you invest ₪40,000 and six months later it's worth ₪32,000. Would you:
A) Sell immediately
B) Feel sick but hold on and wait
C) Buy more while it's cheap

**User:** If my ₪40,000 dropped to ₪32,000 I'd feel sick but hold on and wait. I guess I'm moderate.

**Agent:** Got it — moderate risk. A few more details I still need: how much are you investing, how old are you, what's your timeline, emergency fund, debt, monthly contribution, brokerage, country, knowledge level?

**User:** ₪45,000, I'm 33, about 5 years, yes emergency fund, no debt, ₪1,000/mo, no brokerage, I'm in Israel, I'm a beginner.

**Extracted:** amount: 45000 | age: 33 | risk: moderate | timeline: "~5 years" | hasEmergencyFund: true | hasDebt: false | monthlyContribution: 1000 | brokerage: none | knowledgeLevel: beginner | investmentPreferences: none

---

## 4. Out-of-scope stock picking → ETF redirect

**Rule:** Individual stock picking is out of scope. Redirect toward ETF-based investing — explain why (85–90% of fund managers underperform the market over 10 years), offer a sector ETF alternative, then continue collecting the profile as normal.

**Goal:** "Should I buy NVIDIA stock?"

**Agent:** Picking individual stocks is outside what I do here — 85–90% of professional fund managers fail to beat the market over 10 years, and individual stock picking amplifies that risk. What I can help with: building a passive ETF portfolio, or if you want tech exposure specifically, a semiconductor or tech sector ETF that includes NVIDIA alongside its peers.

Are you open to an ETF-based approach?

**User:** Ok fine, I'm open to ETFs. I have ₪30,000 to invest.

**Agent:** Great — a few details to tailor the plan: age, timeline, risk tolerance, emergency fund, debt, monthly contribution, brokerage, country, knowledge level?

**User:** I'm 29, moderate risk, about 10 years, yes emergency fund, no debt, ₪1,000/mo, no brokerage, I'm in Israel, I'm a beginner.

**Extracted:** amount: 30000 | age: 29 | risk: moderate | timeline: "~10 years" | hasEmergencyFund: true | hasDebt: false | monthlyContribution: 1000 | brokerage: none | knowledgeLevel: beginner | goal: reflects ETF-based investing | investmentPreferences: none

---

## 5. Stated preferences in goal → portfolio defaults skipped

**Rule:** If `investmentPreferences` is already set from the goal or clarification, the portfolio defaults question is skipped — the stage does not ask twice.

**Goal:** "I have ₪100,000 and I want to invest in tech sector ETFs"

**Agent:** Good — a few details I still need: age, country, timeline, risk tolerance, emergency fund, debt, monthly contribution, knowledge level, brokerage?

**User:** I'm 31, Israel, moderate risk, about 15 years, intermediate, yes emergency fund, no debt, ₪2,500/mo, no brokerage.

**Agent:** *(stage completes — no portfolio defaults question asked, tech preference already captured)*

**Extracted:** amount: 100000 | age: 31 | risk: moderate | timeline: "~15 years" | hasEmergencyFund: true | hasDebt: false | monthlyContribution: 2500 | brokerage: none | knowledgeLevel: intermediate | investmentPreferences: "tech sector ETFs"

---

## 6. Multiple instruments without split → split required

**Rule:** If the user names two or more instruments without specifying percentages, ask for the split before treating `investmentPreferences` as complete.

**Goal:** "I have ₪100,000 and I want to invest mainly in S&P 500 and TLV-125 index funds"

**Agent:** Good start — a few details: age, country, timeline, risk tolerance, emergency fund, debt, monthly contribution, knowledge level, brokerage?

**User:** I'm 31, Israel, about 15 years, moderate risk, yes emergency fund, no debt, ₪2,500/mo, intermediate. No brokerage yet.

**Agent:** What percentage would you put in each — for example, 70% S&P 500 and 30% TLV-125, or 50/50?

**User:** 70% S&P 500 and 30% TLV-125.

**Extracted:** amount: 100000 | age: 31 | risk: moderate | timeline: "~15 years" | hasEmergencyFund: true | hasDebt: false | monthlyContribution: 2500 | brokerage: none | knowledgeLevel: intermediate | investmentPreferences: "70% S&P 500, 30% TLV-125"

---

## 7. 100% single-index concentration → valid, captured as-is

**Rule:** 100% concentration in a single index is a valid answer to the portfolio defaults question. The agent does not push back or suggest diversification.

**Goal:** "I have ₪80,000 and I want to start investing"

**Agent:** *(collects required fields, then asks portfolio defaults question)*

**User:** *(provides profile fields: age 32, Israel, 15 years, aggressive, emergency fund, no debt, ₪2,000/mo, intermediate, no brokerage)*

**Agent:** Before I hand this off: what equity allocation do you want? Options include FTSE All-World, S&P 500, NASDAQ-100, TLV-125, or any combination. For the buffer, I'd suggest קרן כספית — shekel-denominated, ~4–5% yield, capital-stable. Does that work?

**User:** 100% NASDAQ. I have strong conviction in tech and a long horizon — I'm fine with the volatility. קרן כספית is fine for the buffer.

**Extracted:** amount: 80000 | age: 32 | risk: aggressive | timeline: "~15 years" | hasEmergencyFund: true | hasDebt: false | monthlyContribution: 2000 | brokerage: none | knowledgeLevel: intermediate | investmentPreferences: "100% NASDAQ, קרן כספית buffer"

---

## 8. Advanced user → knowledge level matched, ETF-101 skipped

**Rule:** When the user signals investing experience, match explanation depth to their level. Skip introductory explanations and engage directly on specifics.

**Goal:** "I have ₪200,000 to invest, I already know the basics"

**Agent:** Great — a few questions to understand your situation: age, timeline, risk tolerance, emergency fund, debt, monthly contribution, brokerage, investing experience, country?

**User:** 34, long-term 20+ years, moderate-to-aggressive, emergency fund yes, no debt, ₪5,000/mo, I have Interactive Brokers. I've been investing for a few years — I know about Irish ETFs, tax efficiency, the basics. I'm in Israel.

**Agent:** *(stage completes — no ETF-101 explanation, no portfolio defaults question since no preferences stated and knowledge level is advanced)*

**Extracted:** amount: 200000 | age: 34 | risk: moderate or aggressive | timeline: "20+ years" | hasEmergencyFund: true | hasDebt: false | monthlyContribution: 5000 | brokerage: Interactive Brokers | knowledgeLevel: intermediate or advanced | investmentPreferences: none
