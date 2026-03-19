# Lazy Advisor — Usage Stories

Realistic scenarios showing how the CLI works in practice. MVP scope: single sessions with plan persistence, no cross-session memory.

The agent is **educational by default** — it explains concepts inline so beginner investors understand *why*, not just *what*. Every recommendation comes with reasoning the user can learn from.

---

## Story 1: The happy path — complete beginner

```
$ lazy-advisor "I have $15k and I want to start investing but I have no idea where to begin"

⚠️  This tool is for educational purposes only. It does not constitute financial
    advice. Consult a licensed financial advisor before making investment decisions.

Agent: Happy to help you get started. A few questions so I can tailor this:
  1. How old are you?
  2. Do you have an emergency fund (3-6 months of expenses)?
  3. Any debt?
  4. When might you need this money?
  5. How would you feel if your investment dropped 20% in a bad month?
  6. Where are you located?
  7. How much can you invest monthly going forward?

You: 28, yes 6 months saved, no debt, this is long-term, a 20% drop would
     stress me but I wouldn't sell, US, probably $500/mo

Agent: Solid foundation. No debt and an emergency fund means you're in a great
  position — you can invest without worrying about needing this money back
  suddenly.

  Based on your answers, I'd put you at a "moderate" risk profile. That means
  we'll build a portfolio that grows well over time but includes some cushioning
  so the rough months don't keep you up at night.

  Let me research the best options for you...
  ✓ Searched "best beginner ETF portfolio 2026 moderate risk"
  ✓ Searched "Fidelity vs Schwab vs Vanguard brokerage comparison 2026 fees"
  ✓ Searched "three-fund portfolio allocation age 28"

  Before the plan, a quick concept: an ETF (Exchange-Traded Fund) is a basket
  of stocks or bonds bundled together. Instead of buying one company and hoping
  it does well, you buy hundreds or thousands at once. If one company tanks,
  the others carry it. That's diversification — and it's the core idea behind
  everything I'm going to recommend.

Plan: "First investment portfolio — $15k"

  Phase 1:
    • Open a Fidelity brokerage account
      I compared the major brokerages. Fidelity has no account fees, no
      minimums, and all the ETFs I'm recommending are commission-free there.
      Schwab is a close second, but Fidelity edges it on fractional share
      support — meaning you can buy $100 of an ETF even if one share costs
      $250. That matters when you're setting up auto-investing later.

  Phase 2:
    • Buy $7.5k VTI — Vanguard Total Stock Market ETF
      This holds over 3,700 US stocks — from Apple and Microsoft down to
      small companies you've never heard of. It costs just 0.03% per year
      in fees (called the "expense ratio" — that's $3 per $10,000 invested).
      This is your growth engine. At 28 with decades ahead, you want the
      majority of your money in stocks.

    • Buy $4.5k VXUS — Vanguard Total International Stock ETF
      Same idea as VTI, but for the rest of the world — Europe, Japan,
      emerging markets like China and India. Why? Because the US stock
      market doesn't always win. There have been full decades where
      international stocks outperformed US stocks. VXUS makes sure you
      benefit no matter which region leads. 0.07% ER.

    • Buy $3k BND — Vanguard Total Bond Market ETF
      Bonds are essentially loans you make to governments and companies.
      They pay you steady interest and don't swing wildly like stocks.
      When stocks drop 20%, bonds typically hold steady or even go up.
      BND is your seatbelt — it won't make you rich, but it'll make
      the scary months a lot less scary. At 0.03% ER, it costs almost
      nothing to hold.

      Remember you said a 20% drop would stress you out? Without BND,
      your portfolio might drop 20%. With BND buffering 20% of your
      portfolio, that same crash might only hit you for 15%. That
      difference matters when you're staring at your phone at 2am.

  Phase 3:
    • Enable dividend reinvestment (DRIP) on all three ETFs
      All three ETFs pay dividends — small cash payments, usually
      quarterly. DRIP automatically uses those payments to buy more
      shares instead of sitting as cash. It's free compounding — your
      money makes money that makes more money. Over 30 years, reinvested
      dividends can account for 30-40% of your total return.

    • Set up $500/mo auto-invest: 50% VTI, 30% VXUS, 20% BND
      This is called "dollar-cost averaging." Every month, $500 goes in
      automatically — you buy more shares when prices are low and fewer
      when prices are high. The big advantage? You never have to think
      about "is now a good time to invest?" The answer is always "yes,
      because I'm investing consistently." This removes emotion from
      the equation, which is the #1 thing that causes beginners to lose
      money.

  Target allocation: 50% US stock / 30% international / 20% bonds.

  This is a well-known approach called a "three-fund portfolio" — it's
  recommended by nearly every financial education resource because it's
  simple, diversified, and extremely low-cost. You're paying about $5
  per year in fees for every $10,000 invested.

  Anything you'd like to adjust?

You: looks good

Agent: Plan saved.
```

---

## Story 2: Simple adjustment — no re-research needed

```
$ lazy-advisor "I'm 35, $20k, moderate risk, long-term retirement savings"

⚠️  Disclaimer...

Agent: Good detail — just a few gaps:
  1. Do you have an emergency fund?
  2. Any debt?
  3. Where are you located?
  4. How much can you invest monthly going forward?
  5. Do you have a brokerage account?

You: yes emergency fund, no debt, US, about $500/mo, yes Fidelity

Agent: Great foundation. Researching...
  ✓ Searched "moderate risk ETF portfolio 2026 retirement age 35"
  ✓ Searched "three-fund portfolio allocation age 35"

Plan: "Retirement portfolio — $20k"

  Phase 1:
    • Buy $10k VTI — Vanguard Total Stock Market ETF
      Your growth engine. Over 3,700 US stocks at 0.03% ER. At 35 with
      30 years to retirement, the majority of your money should be in
      equities — time is on your side.

    • Buy $6k VXUS — Vanguard Total International Stock ETF
      International diversification — Europe, Japan, emerging markets.
      0.07% ER. Ensures you benefit regardless of which region leads
      over the next three decades.

    • Buy $4k BND — Vanguard Total Bond Market ETF
      Your stability cushion. Bonds don't swing like stocks — when
      equities drop 20%, BND typically holds steady. At 20% of your
      portfolio, it smooths the ride without dragging returns. 0.03% ER.

  Phase 2:
    • Enable DRIP on all three ETFs
    • Set up $500/mo auto-invest: 50% VTI, 30% VXUS, 20% BND

  Target allocation: 50% US / 30% international / 20% bonds.

  Anything you'd like to adjust?

You: make it 60/40 stocks and international, skip bonds entirely

Agent: Dropping bonds and redistributing. Since you already said you're
  comfortable with moderate risk, I want to flag: without bonds, a bad
  year could hit 20-25% instead of 15%. You have the timeline to recover,
  but make sure you're okay with that.

  Updated plan:

  Phase 1:
    • Buy $12k VTI — total US market (was $10k)
    • Buy $8k VXUS — international (was $6k)
    • [removed] BND

  Phase 2:
    • Enable DRIP on both ETFs
    • Set up $500/mo auto-invest: 60% VTI, 40% VXUS

  Target allocation: 60% US / 40% international. No bonds.

  Anything else?

You: looks good

Agent: Plan saved.
```

This story shows a pure `adjust` — the user's feedback ("skip bonds, 60/40") can be resolved entirely with existing research. The agent uses `remove_step` (BND) and `update_step` (VTI and VXUS allocations) without re-entering Stage 2. No new searches needed.

---

## Story 3: User pushes back — iteration with re-research

```
$ lazy-advisor "Invest $10k, I'm 25, aggressive risk tolerance"

⚠️  Disclaimer...

Agent: A few questions to fill in the picture:
  1. What's your timeline for this money?
  2. Do you have an emergency fund?
  3. Any debt?
  4. Where are you located?
  5. How much can you invest monthly?
  6. Do you have a brokerage account?

You: long-term, yes emergency fund, no debt, US, maybe $400/mo, no brokerage

Agent: Researching aggressive portfolios for your profile...
  ✓ Searched "aggressive ETF portfolio young investor 2026"
  ✓ Searched "best low-cost brokerage 2026"

  "Aggressive" at 25 makes sense — you have 35+ years for your money to
  compound, which means you can ride out the big drops that come with
  higher-risk investments. The tradeoff: your portfolio will swing more
  in the short term, but historically aggressive portfolios significantly
  outperform conservative ones over long horizons.

Plan: "Aggressive growth portfolio — $10k"

  Phase 1:
    • Open a Fidelity brokerage account

  Phase 2:
    • Buy $6k VTI — total US market (your broad foundation)
    • Buy $3k VWO — Vanguard Emerging Markets ETF
      Emerging markets (China, India, Brazil, Taiwan) are riskier than
      developed markets but have higher growth potential. VWO costs 0.08%
      ER and gives you exposure to economies that are growing faster than
      the US. The risk? Political instability, currency swings, and
      regulatory surprises. That's why it's only 30%, not 60%.
    • Buy $1k SOXX — iShares Semiconductor ETF
      This is a concentrated bet on the chip industry — NVIDIA, AMD,
      TSMC, Broadcom. At 0.35% ER it's pricier than VTI, but semiconductors
      are the backbone of AI, EVs, and cloud computing. The risk: it's
      only ~30 companies, so one bad earnings season hits hard. That's
      why it's a small allocation.

  Phase 3:
    • Set up $400/mo auto-invest: 60% VTI, 30% VWO, 10% SOXX

  No bonds. At 25 with aggressive risk tolerance, you don't need the
  cushion — and every dollar in bonds is a dollar not compounding in
  equities.

  Anything you'd like to adjust?

You: I don't want emerging markets, I want more tech

Agent: That changes the investment mix — I need to research tech ETFs I
  haven't looked at yet. Give me a moment.
  ✓ Searched "best tech ETF besides QQQ 2026 expense ratio"

  Dropping VWO and adding tech exposure. Here's what I'd recommend:

  Updated Phase 2:
    • Buy $5k VTI — total US market
      Still keeping this as your base. VTI already has ~30% tech
      (Apple, Microsoft, Google are its top holdings), so even your
      "broad" fund is tech-heavy.
    • Buy $3k VGT — Vanguard Information Technology ETF
      Pure tech — 350+ companies, 0.10% ER. Heavier on enterprise tech
      (Microsoft, Apple, Salesforce) compared to SOXX which is pure
      hardware/chips.
    • Buy $2k SOXX — iShares Semiconductor ETF
      Kept from the original plan. Chips + software together give you
      full tech stack coverage.

  Phase 3:
    • Set up $400/mo auto-invest: 50% VTI, 30% VGT, 20% SOXX

  Fair warning: with VGT + SOXX + VTI's natural tech weighting, roughly
  65% of your money is in tech. If the tech sector specifically has a bad
  year (like 2022, when the NASDAQ dropped 33%), you'll feel it a lot
  more than the broad market. That's the tradeoff with concentration —
  bigger wins in good times, bigger pain in bad times.

  You said aggressive, so this fits. But I want you going in with eyes open.

  Anything else?

You: that's what I want, go for it

Agent: Plan saved.
```

---

## Story 4: Unrealistic expectations

```
$ lazy-advisor "I have $5k and I want to double it in 6 months"

⚠️  Disclaimer...

Agent: I want to be upfront with you — doubling your money in 6 months means
  a 100% return. To put that in context:

  • The S&P 500 (the "stock market") averages about 10% per year
  • The best year in the last decade was about 30%
  • To get 100% in 6 months, you'd need speculative trading — options,
    meme stocks, crypto. That's not investing, it's gambling. Some people
    win, but most lose money, and it's outside what this tool does.

  What ETF investing actually looks like:
  • $5k invested at 10% average return = ~$13k in 10 years, ~$34k in 20 years
  • Add $200/mo and those numbers become ~$50k in 10 years, ~$160k in 20 years
  • That's the power of compound growth — it's slow at first, then accelerates

  The "lazy investor" approach isn't about getting rich quick. It's about
  getting rich slowly and reliably.

  Want me to plan a realistic long-term strategy?

You: ok fine, long term then, moderate risk

Agent: Great — a few more things so I can tailor this:
  1. How old are you?
  2. Do you have an emergency fund?
  3. Any debt?
  4. Where are you located?
  5. How much can you invest monthly?
  6. Do you have a brokerage account?

You: 24, yes to emergency fund, no debt, US, maybe $200/mo, no brokerage

Agent: Researching...
  ✓ Searched "best ETF portfolio $5000 starting 2026 age 24"

Plan: "Starter portfolio — $5k"

  Phase 1:
    • Open a Fidelity brokerage account

  Phase 2:
    • Buy $3k VTI — total US market
    • Buy $2k VXUS — international diversification

  Phase 3:
    • Set up $200/mo auto-invest: 60% VTI, 40% VXUS
      That's $2,400/yr of new shares buying into the market at all
      different price levels. Consistency matters more than amount.

  At $5k I'm keeping this to two funds. Adding bonds at this size would
  mean tiny positions that don't move the needle. When you pass $15-20k,
  adding BND (bonds) starts to make sense as a risk cushion.

  Anything you'd like to adjust?

You: makes sense, thanks

Agent: Plan saved.
```

---

## Story 5: Outside scope — individual stocks

```
$ lazy-advisor "Should I buy NVIDIA stock? It's been going up a lot"

⚠️  Disclaimer...

Agent: I can't help with individual stock picks — that's outside what this
  tool does, and for good reason.

  Here's why: picking individual stocks is essentially betting that you know
  something the market doesn't. Professional fund managers with teams of
  analysts fail to beat the market 85-90% of the time over 10-year periods.
  That's not an opinion — it's data from the S&P SPIVA scorecards.

  The lazy investor philosophy is the opposite: instead of trying to pick
  winners, you buy the entire market and guarantee you get the market's
  return. If NVIDIA goes up 200%, you benefit (it's in VTI and VGT). If
  it crashes, it's a tiny slice of your portfolio, not the whole thing.

  If you're excited about the semiconductor space specifically, I can plan
  an ETF portfolio that includes semiconductor exposure through SOXX or SMH —
  you get the upside of the sector without betting on a single company.

  Want me to build a portfolio with semiconductor exposure?

You: yeah sure, I have $8k, long term, I'm ok with risk

Agent: Before I research, a few quick questions:
  1. How old are you?
  2. Emergency fund in place?
  3. Any debt?
  4. Where are you located?
  5. How much can you invest monthly?
  6. Do you have a brokerage account?

You: 29, yes, no debt, US, $300/mo, no brokerage

Agent: Researching...
  ✓ Searched "semiconductor ETF options 2026 SOXX SMH comparison"
  ✓ Searched "best brokerage for ETFs 2026"
  ...
```

---

## Story 6: Search returns weak or mixed results

```
$ lazy-advisor "I want to invest $20k with focus on clean energy ETFs"

⚠️  Disclaimer...

Agent: I like the direction. A few questions first:
  1. How old are you?
  2. What's your timeline?
  3. Risk tolerance — conservative, moderate, or aggressive?
  4. Emergency fund in place?
  5. Any debt?
  6. Where are you located?
  7. How much can you invest monthly?
  8. Do you have a brokerage account?

You: 31, long-term (10+ years), moderate, yes emergency fund, no debt, US,
     $400/mo, no brokerage

Agent: Solid position. Let me research clean energy options.
  ✓ Searched "best clean energy ETFs 2026 expense ratio performance"
  ✓ Searched "ICLN QCLN PBW clean energy ETF comparison 2026"

  I want to be transparent with you about what I found.

  Clean energy ETFs exist, but they've had a rough stretch:
    • ICLN (iShares Global Clean Energy) — 0.40% ER, the largest and most
      liquid. But it's down about 35% from its 2021 peak. High expense
      ratio compared to broad market ETFs (13x more than VTI's 0.03%).
    • QCLN (First Trust NASDAQ Clean Edge) — 0.58% ER, more US-focused.
      Similar underperformance.
    • Both have significantly lagged VTI over the past 3 years.

  Why? Clean energy companies often aren't profitable yet, they depend on
  government subsidies that can change with elections, and rising interest
  rates in 2022-2024 hit growth sectors hard.

  Does that mean clean energy is a bad investment? Not necessarily — it
  could be a long-term winner as the world transitions. But the higher
  fees and volatile track record mean I wouldn't put your whole $20k there.

  My recommendation: clean energy as a "tilt" (20-25%) on top of a
  diversified core. That way if clean energy takes off, you benefit. If
  it doesn't, VTI and VXUS carry your portfolio.

  Want me to plan it that way?

You: yes, maybe 25% clean energy

Agent: Plan:

  Phase 1:
    • Open a brokerage account

  Phase 2:
    • Buy $9k VTI — your broad US foundation (0.03% ER)
      This already includes some clean energy companies, plus everything
      else. It's your safety net.
    • Buy $6k VXUS — international diversification (0.07% ER)
      Many clean energy supply chains are global — VXUS gives you exposure
      to international companies in the space indirectly.
    • Buy $5k ICLN — your clean energy tilt (0.40% ER)
      Going with ICLN over QCLN because it's more liquid (easier to buy/sell),
      has a lower expense ratio, and includes global clean energy companies
      not just US.

  Phase 3:
    • Set up $400/mo auto-invest: 45% VTI, 30% VXUS, 25% ICLN

  Your blended expense ratio is about 0.11% — higher than a pure three-fund
  portfolio but still very cheap. You're paying about $22/year per $20k.

  Anything you'd like to adjust?
```

---

## Story 7: User is too vague, even after clarification

```
$ lazy-advisor "invest"

⚠️  Disclaimer...

Agent: I'd love to help! I need a bit more to work with:
  1. How much are you looking to invest?
  2. How old are you?
  3. What's the goal — retirement, medium-term growth, something else?

You: idk some money

Agent: Totally fine — rough answers work. Let me make it easier:
  - Are we talking hundreds, thousands, or tens of thousands?
  - Are you in your 20s, 30s, 40s?
  - Will you need this money in the next 2 years, or can you leave it alone?

You: like $3k, I'm 30, don't need it for a while

Agent: Almost there — a few more so I don't steer you wrong:
  - Do you have some savings set aside for emergencies?
  - Any debt (student loans, credit card, etc.)?
  - Where are you located?
  - Can you put in anything monthly, even a small amount?
  - If your $3k dropped to $2.4k in a bad month, would you panic or shrug?

You: yeah I have savings, no debt, US, maybe $50-100/mo, I'd probably shrug

Agent: Great — that's everything I need. Researching...
  ✓ Searched "simple ETF portfolio $3000 beginner 2026"

  At $3k I'm going to keep this as simple as possible — one fund. Not
  because diversification doesn't matter, but because splitting $3k into
  three $1k positions adds complexity without much benefit at this size.
  As your balance grows, we can split it up.

Plan: "Simple starter portfolio — $3k"

  Phase 1:
    • Open a Fidelity brokerage account

  Phase 2:
    • Buy $3k VT — Vanguard Total World Stock ETF
      One fund that holds over 9,500 stocks across the entire world —
      US, Europe, Japan, emerging markets, everything. It's essentially
      VTI + VXUS combined into one ticker. 0.07% ER. You own a slice
      of the global economy in a single purchase.

  Phase 3:
    • Set up $75/mo auto-invest into VT
      You said $50-100, so splitting the difference. Consistency matters
      more than amount — $75/mo is $900/year of new shares. It adds up.

  When your balance passes $10-15k, it makes sense to split into separate
  funds for more control over your US/international/bond mix. But right
  now, VT gives you everything in one place.

  Anything you'd like to adjust?
```

---

## Story 8: Contradictory input

```
$ lazy-advisor "I want maximum returns but I can't afford to lose any money"

⚠️  Disclaimer...

Agent: I hear this a lot, and I want to explain why those two goals pull in
  opposite directions — because understanding this is probably the most
  important thing about investing.

  Higher returns come from risk. A savings account pays 0.5% because there's
  zero risk — your money is guaranteed. Stocks average 10% because there IS
  risk — in a bad year, you might lose 20-30%. Bonds sit in the middle:
  ~4-5% return, smaller swings.

  That's not a flaw in the system — it's the fundamental rule. The return
  IS the compensation for accepting risk. If stocks were guaranteed to go
  up, everyone would buy them and the price would rise until the return
  was the same as a savings account.

  So the real question isn't "how do I get max returns with no risk?" — it's
  "how much risk can I actually handle?"

  Let me ask it this way: you invest $10k and six months later it's worth
  $8k. What do you do?
    A) Sell immediately — I can't handle this
    B) Feel sick but hold on and wait
    C) Buy more while it's cheap

You: probably B

Agent: That's moderate risk tolerance — and honestly, that's where most people
  land. Nothing wrong with it.

  Here's what "moderate" looks like in practice:
    • Average year: up 7-8%
    • Great year: up 15-20%
    • Bad year: down 10-15% (but recovers within 1-2 years historically)
    • Terrible year (2008-level): down 20-25%, recovers in 2-3 years

  It won't double in a year. But it won't keep you up at night either.

  Now I need a few details to build your plan:
  1. How much are you investing?
  2. How old are you?
  3. What's your timeline?
  4. Emergency fund in place?
  5. Any debt?
  6. Where are you located?
  7. How much can you invest monthly?
  8. Do you have a brokerage account?

You: $12k, I'm 33, at least 5 years, yes emergency fund, no debt, US,
     $300/mo, no brokerage

Agent: Researching...
  ✓ Searched "moderate risk ETF portfolio 2026 age 33"

Plan: "Moderate growth portfolio — $12k"

  Phase 1:
    • Open a Fidelity brokerage account

  Phase 2:
    • Buy $5.5k VTI — total US market (your growth portion)
    • Buy $3.5k VXUS — international diversification
    • Buy $3k BND — total bond market (your stability portion)

      The 25% bond allocation is what makes this "moderate" instead of
      "aggressive." In the 2022 bear market, a 75/25 stock/bond portfolio
      dropped about 15% while 100% stocks dropped 20%. That 5% difference
      doesn't sound like much, but on $12k it's the difference between
      losing $1,800 vs $2,400. More importantly, it's the difference
      between holding on and panic selling.

  Phase 3:
    • Enable DRIP on all three
    • Set up $300/mo auto-invest: 45% VTI, 30% VXUS, 25% BND

  Anything you'd like to adjust?
```

---

## Story 9: Mid-session profile change — backtracking through the pipeline

```
$ lazy-advisor "I'm 32, have $25k to invest, long-term, moderate risk"

⚠️  Disclaimer...

Agent: Good detail — just a few more:
  1. Emergency fund in place?
  2. Any debt?
  3. Where are you located?
  4. How much can you invest monthly?
  5. Do you have a brokerage account?

You: yes emergency fund, no debt, US, $600/mo, no brokerage

Agent: Researching...
  ✓ Searched "moderate risk ETF portfolio 2026 $25k"
  ✓ Searched "best brokerage account 2026 comparison"

Plan: "Moderate growth portfolio — $25k"

  Phase 1:
    • Open a Fidelity brokerage account

  Phase 2:
    • Buy $12.5k VTI — total US market
    • Buy $7.5k VXUS — international diversification
    • Buy $5k BND — total bond market (stability cushion)

  Phase 3:
    • Enable DRIP on all three
    • Set up $600/mo auto-invest: 50% VTI, 30% VXUS, 20% BND

  Anything you'd like to adjust?

You: oh wait, I said US but I'm actually based in Israel — sorry about that

Agent: That changes things significantly — the ETFs, brokerages, and tax
  treatment are all different for Israeli investors. Let me re-research
  with that in mind.
  ✓ Searched "best ETF investing from Israel 2026 tax efficiency"
  ✓ Searched "Interactive Brokers Israel account opening"
  ✓ Searched "Irish accumulating ETFs vs Israeli index funds comparison"

  Since you're in Israel, your options look different. Let me explain
  the three paths available to you:

  • Israeli index funds (קרנות מחקות) — simple, traded on TASE in ILS.
    Higher expense ratios (0.2-0.8%) but no currency conversion, no
    foreign broker needed, straightforward tax reporting.

  • Irish accumulating ETFs (VWRA, CSPX) — best tax efficiency. Dividends
    reinvested internally at 15% withholding (US-Ireland treaty) instead
    of 25% Israeli dividend tax. You only pay Israeli tax when you sell.
    Requires Interactive Brokers.

  • US ETFs (VTI, VOO) — lowest expense ratios but dividends taxed at
    25% every time they're paid out. That tax drag adds up over decades.

  For your profile — long-term, moderate, $25k — I'd recommend Irish
  accumulating ETFs through Interactive Brokers. The tax savings compound
  significantly over time.

  A note on how this changes your allocation: your US plan was 80/20
  equity/bonds. I'm keeping that same ratio, but the funds are different.

Updated Plan: "Moderate growth portfolio — $25k (Israel)"

  Phase 1:
    • Open an Interactive Brokers account
      It's the standard broker for Israeli investors accessing international
      markets. Account opening takes about a week, requires ID verification
      and a proof of address.

  Phase 2:
    • Buy $15k VWRA — Vanguard FTSE All-World (accumulating)
      This is the Irish equivalent of VT — global stocks, single fund,
      dividends reinvested automatically. 0.22% ER (higher than VT's
      0.07%, but the tax savings more than compensate over time).

      Important: VWRA already includes ~60% US stocks (Apple, Microsoft,
      etc.) plus international. So unlike your US plan where we split VTI
      and VXUS, here one fund covers both. No need for a separate US tilt —
      adding CSPX on top would overweight the US to ~75%, which defeats
      the purpose of global diversification.

    • Buy $5k AGGU — iShares Global Aggregate Bond (accumulating)
      Global bonds, accumulating structure. Your stability portion,
      with the same tax advantages as VWRA. 0.10% ER.

  Phase 3:
    • Set up $600/mo transfers to IB and buy: 80% VWRA, 20% AGGU
      IB doesn't have "auto-invest" like Fidelity. You'll need to log in
      monthly and place the orders manually. It takes 5 minutes. Set a
      calendar reminder.

  Target allocation: 80% equity / 20% bonds — same as your US plan.
  The difference is all tax efficiency: accumulating structure means
  dividends reinvest at 15% withholding (US-Ireland treaty) instead of
  25% Israeli dividend tax. Over 20 years on $25k with $600/mo
  contributions, that difference can amount to tens of thousands of
  shekels in tax savings.

  Anything you'd like to adjust?

You: looks great

Agent: Plan saved.
```

This story shows `research_and_adjust` triggered by a profile correction. The user initially said "US" but corrects to Israel — invalidating the previous research (US brokerages, US ETFs, US tax assumptions). The agent loops back through Stage 2 with locale context before rebuilding the plan in Stage 3.

---

## Story 10: Iteration limit reached

```
$ lazy-advisor "I'm 26, $12k, aggressive, long-term"

⚠️  Disclaimer...

Agent: A few quick questions:
  1. Emergency fund in place?
  2. Any debt?
  3. Where are you located?
  4. How much can you invest monthly?
  5. Do you have a brokerage account?

You: yes, no debt, US, $400/mo, no brokerage

Agent: Researching...
  ✓ Searched "aggressive ETF portfolio young investor 2026"
  ✓ Searched "best brokerage account 2026 no minimums"

Plan: "Aggressive growth portfolio — $12k"

  Phase 1:
    • Open a Fidelity brokerage account

  Phase 2:
    • Buy $7k VTI — total US market
    • Buy $3k VWO — emerging markets
    • Buy $2k SOXX — semiconductors

  Phase 3:
    • Set up $400/mo auto-invest: 60% VTI, 25% VWO, 15% SOXX

  Anything you'd like to adjust?

You: drop emerging markets, more US
                                          [Iteration 1 — adjust]

Agent: Updated:
  Phase 2:
    • Buy $9k VTI — total US market (was $7k)
    • [removed] VWO
    • Buy $3k SOXX — semiconductors (was $2k)

  Phase 3:
    • Set up monthly auto-invest: 75% VTI, 25% SOXX

  Anything else?

You: actually add some international back, maybe 20%
                                          [Iteration 2 — adjust]

Agent: Updated:
  Phase 2:
    • Buy $7k VTI — total US market
    • Buy $2.5k VXUS — international developed markets
    • Buy $2.5k SOXX — semiconductors

  Phase 3:
    • Set up monthly auto-invest: 58% VTI, 21% VXUS, 21% SOXX

  Anything else?

You: what about clean energy instead of semiconductors?
                                          [Iteration 3 — research_and_adjust]

Agent: That's a different sector — let me look into it.
  ✓ Searched "clean energy ETF 2026 ICLN QCLN performance"

  I'd go with ICLN (iShares Global Clean Energy, 0.40% ER). Fair warning:
  clean energy ETFs have been volatile — ICLN is down ~35% from its 2021
  peak. At your age you can ride that out, but it's a rougher ride than
  semiconductors.

  Updated:
  Phase 2:
    • Buy $7k VTI — total US market
    • Buy $2.5k VXUS — international
    • Buy $2.5k ICLN — clean energy (was SOXX)

  Phase 3:
    • Set up monthly auto-invest: 58% VTI, 21% VXUS, 21% ICLN

  Anything else?

You: hmm go back to semiconductors, but make it a smaller position
                                          [Iteration 4 — adjust]

Agent: Updated:
  Phase 2:
    • Buy $8k VTI — total US market
    • Buy $2.5k VXUS — international
    • Buy $1.5k SOXX — semiconductors

  Phase 3:
    • Set up monthly auto-invest: 67% VTI, 21% VXUS, 12% SOXX

  Anything else?

You: actually can you look into AI-focused ETFs instead?
                                          [Iteration 5 — limit reached]

Agent: We've been through several rounds — here's your current plan. I'd
  suggest going with what we have. You can always start a new session to
  explore a different direction.

  Final plan:

  Phase 1:
    • Open a Fidelity brokerage account

  Phase 2:
    • Buy $8k VTI — total US market
    • Buy $2.5k VXUS — international
    • Buy $1.5k SOXX — semiconductors

  Phase 3:
    • Set up $400/mo auto-invest: 67% VTI, 21% VXUS, 12% SOXX

  Plan saved.
```

This story shows the iteration limit (max 5) being reached. The user keeps going back and forth — mix of `adjust` (iterations 1, 2, 4) and `research_and_adjust` (iteration 3). On the 5th attempt, the agent presents the current plan as final instead of processing another change. The plan was already persisted on iteration 4's `plan_complete`, so nothing is lost.

---

## Story 11: Search failure — pipeline hard stop

```
$ lazy-advisor "I'm 27, $10k, moderate risk, long-term"

⚠️  Disclaimer...

Agent: A few quick questions:
  1. Emergency fund in place?
  2. Any debt?
  3. Where are you located?
  4. How much can you invest monthly?
  5. Do you have a brokerage account?

You: yes, no debt, US, $300/mo, no brokerage

Agent: Researching...
  ✗ Search failed — retrying...
  ✗ Search failed — retrying...
  ✗ Search failed.

  I wasn't able to retrieve current financial data right now. I don't want
  to build a plan without verified information — ETF recommendations need
  up-to-date expense ratios, performance data, and fund availability.

  Please try again in a few minutes. Nothing was saved, so you'll start
  fresh.
```

This story shows the search failure hard stop. Stage 2 retried 3 times with exponential backoff, all failed. The pipeline stops at the code level — Stage 3 never runs. This is a deliberate safety property: the agent cannot be coerced (by prompt or otherwise) into generating a plan without verified research data. No plan was persisted because `plan_complete` never fired.

---

## Story 12: Non-US locale from the start — Israeli investor

```
$ lazy-advisor "I'm 29, living in Israel, have ₪80,000 to invest"

⚠️  Disclaimer...

Agent: Great — since you're in Israel, your investing landscape is quite
  different from the US. A few questions to tailor your plan:
  1. What's your timeline for this money?
  2. Risk tolerance — could you stomach a 20% drop?
  3. Do you have an emergency fund (3-6 months of expenses)?
  4. Any debt?
  5. How much can you invest monthly?
  6. Do you have a brokerage account?

You: long-term, at least 10 years. moderate risk — I'd hold but wouldn't
     enjoy it. yes emergency fund, no debt, maybe ₪2,000/mo, no brokerage

Agent: Solid foundation. Let me research what works for Israeli investors.
  ✓ Searched "best investment options Israel 2026 קרנות מחקות vs Irish ETFs"
  ✓ Searched "Israeli brokerages 2026 Meitav IBI international ETF fees"
  ✓ Searched "Irish accumulating ETFs VWRA AGGU tax efficiency Israel 2026"

  Before the plan, I need to explain your options — because Israeli
  investors have three paths, each with real tradeoffs:

  • Israeli index funds (קרנות מחקות) — traded on TASE in ILS. Managed
    by local firms (Migdal, Harel, KSM). No currency conversion, simple
    tax reporting through your broker. Expense ratios are higher than
    international options (0.2-0.8%), but the convenience is significant —
    everything is in shekels, your broker handles tax reporting to mas
    hachnasa, and you can buy/sell during Israeli market hours.

  • Irish accumulating ETFs (VWRA, AGGU) — traded on European exchanges
    in USD or EUR. Dividends reinvest automatically inside the fund at 15%
    withholding (US-Ireland treaty) instead of 25% Israeli dividend tax.
    You don't pay Israeli tax until you sell. Best for long-term tax
    efficiency, but requires a broker with access to European exchanges.

  • US ETFs (VTI, VOO) — lowest expense ratios (0.03%), but dividends
    are distributed and taxed at 25% every time they're paid out. That's
    money leaving your portfolio quarterly. Also requires USD conversion.

  For your profile — long-term, moderate, ₪80k — I'd recommend Irish
  accumulating ETFs. The tax savings compound significantly over 10+
  years and more than offset the higher expense ratios.

  Now, the broker question. You have two real options:

  • Israeli broker (Meitav, IBI, Psagot) — single account for both TASE
    and international markets. Higher commissions on international trades
    (₪20-30 per trade typical), but you get one account, one app, tax
    reporting handled automatically. Customer support in Hebrew.

  • Interactive Brokers — lower commissions ($1-2 per trade), better
    execution, wider fund selection. But it's a foreign account — you're
    responsible for reporting to mas hachnasa yourself or through your
    accountant. Interface is more complex.

  For simplicity with ₪2,000/mo contributions, an Israeli broker makes
  sense — the convenience of automatic tax reporting and shekel transfers
  outweighs the commission difference at your investment size.

  Do you have a preference, or should I go with an Israeli broker?

You: Israeli broker sounds easier, go with that

Agent: Agreed. Going with Meitav — they have the best international ETF
  access among Israeli brokers and a reasonable fee structure.

Plan: "Moderate growth portfolio — ₪80,000 (Israel)"

  Phase 1:
    • Open a Meitav investment account (חשבון מסחר עצמאי)
      Meitav offers self-directed trading with access to both TASE and
      international exchanges. Account opening is online, takes a few
      days with ID verification. Make sure to open a "מסחר עצמאי" account,
      not a managed account — you don't need someone else making decisions
      and charging management fees.

  Phase 2:
    • Buy ₪48,000 VWRA — Vanguard FTSE All-World (accumulating, Irish)
      Over 3,700 stocks across the entire world — US, Europe, Japan,
      emerging markets. 0.22% ER. The accumulating structure means
      dividends reinvest inside the fund at 15% withholding instead of
      25% Israeli tax. You only pay Israeli capital gains tax (25%) when
      you sell — and with a 10+ year horizon, that deferral is powerful.

      You'll buy this in USD through Meitav's international desk. The
      currency conversion happens automatically — Meitav charges a small
      spread (~0.3%) on the conversion.

    • Buy ₪16,000 AGGU — iShares Global Aggregate Bond (accumulating, Irish)
      Global bonds, same accumulating tax advantage as VWRA. Your stability
      portion — when equities drop, bonds cushion the fall. 0.10% ER.
      At 20% of your portfolio, it keeps the rough months manageable
      without dragging long-term returns.

    • Buy ₪16,000 קרן מחקה S&P 500 (e.g., Harel/KSM S&P 500)
      A local Israeli index fund tracking the S&P 500, traded on TASE in
      shekels. 0.25% ER. Why mix in a local fund? Two reasons: no currency
      conversion cost on this portion, and it diversifies your broker risk
      — part of your money is on TASE, part on international exchanges.
      Think of it as not putting all your eggs in one settlement system.

  Phase 3:
    • Set up ₪2,000/mo standing order (הוראת קבע) to Meitav
    • Monthly allocation: 60% VWRA, 20% AGGU, 20% קרן מחקה S&P 500
      Meitav doesn't have US-style auto-invest. You'll need to log in
      monthly and place the orders yourself — takes about 10 minutes.
      Set a calendar reminder for after your salary lands.

  Target allocation: 80% equity / 20% bonds.

  A note on taxes: Meitav will handle the Israeli tax reporting for your
  TASE holdings automatically. For the Irish ETFs (VWRA, AGGU), they
  report the holdings to mas hachnasa but you should verify with your
  accountant that the accumulating structure is reported correctly —
  especially the distinction between "deemed dividend" (רווח רעיוני)
  and actual capital gains. This matters when you eventually sell.

  Anything you'd like to adjust?

You: looks great, thanks

Agent: Plan saved.
```

This story shows locale awareness from the start — no mid-session correction needed. Unlike Story 9 where the user corrects "US" to "Israel" mid-plan, here the agent knows the locale from Stage 1 and tailors everything accordingly: the three fund types are presented as part of the natural flow, Israeli brokerages are compared on their merits (not as an afterthought), currency conversion costs are factored into the plan, and tax reporting nuances (mas hachnasa, רווח רעיוני) are addressed proactively. The agent also asks the user to choose between broker types before building the plan — a locale-specific decision that wouldn't exist for a US investor.

---

## What these stories show

1. **Happy path** (Story 1): Full flow — clarify, research, plan with detailed explanations so the user understands every decision.
2. **Simple adjustment** (Story 2): User requests a change that can be resolved with existing research (`adjust`) — agent uses `remove_step`/`update_step` to modify the plan without re-searching.
3. **Iteration with re-research** (Story 3): User pushes back with something that requires new research (`research_and_adjust`) — agent searches for tech ETFs it hadn't looked up, then rebuilds the plan.
4. **Boundaries** (Story 4): Agent is honest about unrealistic expectations, educates on what investing actually looks like, then redirects.
5. **Scope limits** (Story 5): Agent stays in its lane (ETFs, not stock picks), explains *why* ETFs over individual stocks, and offers an alternative.
6. **Weak data** (Story 6): Agent is transparent when research is mixed, explains the underlying reasons, and recommends a balanced approach.
7. **Vague users** (Story 7): Agent handles minimal input gracefully, simplifies questions, and adapts the plan complexity to the investment size.
8. **Contradictions** (Story 8): Agent uses the contradiction as a teaching moment, explains the risk/return relationship, and helps the user discover their actual risk tolerance.
9. **Profile change mid-session** (Story 9): User reveals they're in Israel after receiving a US-centric plan (`research_and_adjust`). Agent recognizes the entire research basis is invalidated, loops back through Stage 2 with locale context, and rebuilds from scratch.
10. **Iteration limit** (Story 10): User keeps tweaking through a mix of `adjust` and `research_and_adjust` iterations. On the 5th attempt, the agent presents the current plan as final. Demonstrates graceful degradation when the user can't settle on a direction.
11. **Search failure** (Story 11): Search API is down — all 3 retries fail. Pipeline hard-stops at Stage 2. No plan generated, no data persisted. Demonstrates the code-level safety gate that prevents unverified recommendations.
12. **Non-US locale from start** (Story 12): Israeli investor with locale known from the first message. Agent tailors everything upfront — three fund types explained, Israeli vs international broker comparison, currency and tax nuances — without any mid-session backtracking.

The agent is educational throughout — every recommendation comes with reasoning. The user doesn't just get a plan, they understand *why* each piece is there. That's the "lazy investor" philosophy: understand once, then trust the process.
