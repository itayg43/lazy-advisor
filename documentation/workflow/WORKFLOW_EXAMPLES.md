# Lazy Advisor — Usage Stories

Realistic scenarios showing how the CLI works in practice. MVP scope: single sessions with plan persistence, no cross-session memory.

The agent is **educational by default** — it explains concepts inline so beginner investors understand *why*, not just *what*. Every recommendation comes with reasoning the user can learn from.

All users are based in Israel. The agent tailors recommendations to Israeli investors: Irish-domiciled accumulating ETFs for tax efficiency, Israeli brokerages (Meitav, IBI) vs Interactive Brokers, קרנות מחקות for local exposure, and shekel-denominated amounts.

---

## Story 1: The happy path — complete beginner

```
$ lazy-advisor "I have ₪55,000 and I want to start investing but I have no idea where to begin"

⚠️  This tool is for educational purposes only. It does not constitute financial
    advice. Consult a licensed financial advisor before making investment decisions.

Agent: Happy to help you get started. A few questions so I can tailor this:
  1. How old are you?
  2. Do you have an emergency fund (3-6 months of expenses)?
  3. Any debt?
  4. When might you need this money?
  5. How would you feel if your investment dropped 20% in a bad month?
  6. How much can you invest monthly going forward?
  7. Do you have a brokerage account?

You: 28, yes 6 months saved, no debt, this is long-term, a 20% drop would
     stress me but I wouldn't sell, about ₪1,800/mo, no brokerage

Agent: Solid foundation. No debt and an emergency fund means you're in a great
  position — you can invest without worrying about needing this money back
  suddenly.

  Based on your answers, I'd put you at a "moderate" risk profile. That means
  we'll build a portfolio that grows well over time but includes some cushioning
  so the rough months don't keep you up at night.

  One more thing — how long is "long-term" for you? 10 years? 20? Until
  retirement?

You: I'd say about 20 years, maybe until I'm around 50.

Agent: Great — 20 years is a solid horizon. Let me research the best options
  for you.
  ✓ Searched "best ETF investing from Israel 2026 tax efficiency"
  ✓ Searched "Irish accumulating ETFs VWRA AGGU Israeli investor"
  ✓ Searched "Israeli brokerages 2026 Meitav IBI international ETF fees"

  Before the plan, a quick concept: an ETF (Exchange-Traded Fund) is a basket
  of stocks or bonds bundled together. Instead of buying one company and hoping
  it does well, you buy hundreds or thousands at once. If one company tanks,
  the others carry it. That's diversification — and it's the core idea behind
  everything I'm going to recommend.

  As an Israeli investor, you have three paths:

  • Israeli index funds (קרנות מחקות) — traded on TASE in shekels. Simple tax
    reporting, no currency conversion. Higher expense ratios (0.2-0.8%).

  • Irish accumulating ETFs (VWRA, AGGU) — best tax efficiency. Dividends
    reinvest inside the fund at 15% withholding (US-Ireland treaty) instead
    of 25% Israeli dividend tax. You only pay tax when you sell.

  • US ETFs (VTI, VOO) — lowest expense ratios but dividends taxed at 25%
    every time they're paid out. That tax drag adds up over decades.

  For your 20-year horizon, I'd recommend Irish accumulating ETFs — the tax
  savings compound significantly over time.

Plan: "First investment portfolio — ₪55,000"

  Phase 1:
    • Open a Meitav investment account (חשבון מסחר עצמאי)
      Meitav has the best international ETF access among Israeli brokers and
      handles tax reporting to mas hachnasa automatically. Make sure to open
      a "מסחר עצמאי" account, not a managed account — you don't need someone
      else making decisions and charging management fees.

  Phase 2:
    • Buy ₪33,000 VWRA — Vanguard FTSE All-World (accumulating, Irish)
      This holds over 3,700 stocks across the entire world — US, Europe,
      Japan, emerging markets, everything. 0.22% ER. The accumulating
      structure means dividends reinvest inside the fund at 15% withholding
      instead of 25% Israeli tax. You only pay Israeli capital gains tax
      (25%) when you sell — and with 20 years ahead, that deferral is
      powerful.

    • Buy ₪11,000 AGGU — iShares Global Aggregate Bond (accumulating, Irish)
      Bonds are essentially loans you make to governments and companies.
      They pay steady interest and don't swing wildly like stocks. When
      stocks drop 20%, bonds typically hold steady or even go up. AGGU is
      your seatbelt — it won't make you rich, but it'll make the scary
      months a lot less scary. 0.10% ER, same tax advantage as VWRA.

      Remember you said a 20% drop would stress you out? Without bonds,
      your portfolio might drop 20%. With AGGU buffering 20% of your
      portfolio, that same crash might only hit you for 15%. That difference
      matters when you're staring at your phone at 2am.

    • Buy ₪11,000 קרן מחקה S&P 500 (e.g., Harel/KSM S&P 500)
      A local Israeli index fund tracking the S&P 500, traded on TASE in
      shekels. 0.25% ER. Why mix in a local fund? No currency conversion
      cost on this portion, and it diversifies your broker risk — part of
      your money is on TASE, part on international exchanges.

  Phase 3:
    • Set up ₪1,800/mo standing order (הוראת קבע) to Meitav
    • Monthly allocation: 60% VWRA, 20% AGGU, 20% קרן מחקה S&P 500
      Meitav doesn't have US-style auto-invest. You'll need to log in
      monthly and place the orders yourself — takes about 10 minutes.
      Set a calendar reminder for after your salary lands.

  Target allocation: 80% equity / 20% bonds.

  This is a well-known diversified approach adapted for Israeli tax efficiency.
  You're paying about 0.19% blended expense ratio — roughly ₪105 per year
  for every ₪55,000 invested.

  Anything you'd like to adjust?

You: looks good

Agent: Plan saved.
```

---

## Story 2: Simple adjustment — no re-research needed

```
$ lazy-advisor "I'm 35, ₪75,000, moderate risk, long-term retirement savings"

⚠️  Disclaimer...

Agent: Good detail — just a few gaps:
  1. Do you have an emergency fund?
  2. Any debt?
  3. How much can you invest monthly going forward?
  4. Do you have a brokerage account?

You: yes emergency fund, no debt, about ₪2,000/mo, yes I have IBI

Agent: Great foundation. Researching...
  ✓ Searched "moderate risk ETF portfolio Israel 2026 retirement"
  ✓ Searched "Irish accumulating ETFs Israeli investor tax efficiency"

Plan: "Retirement portfolio — ₪75,000"

  Phase 1:
    • Buy ₪45,000 VWRA — Vanguard FTSE All-World (accumulating, Irish)
      Global stocks, single fund, dividends reinvest automatically at 15%
      withholding. Your growth engine. At 35 with 30 years to retirement,
      the majority of your money should be in equities.

    • Buy ₪15,000 AGGU — iShares Global Aggregate Bond (accumulating, Irish)
      Your stability cushion. When equities drop 20%, bonds typically hold
      steady. At 20% of your portfolio, it smooths the ride without dragging
      returns. 0.10% ER.

    • Buy ₪15,000 קרן מחקה S&P 500 — local Israeli index fund
      Shekel-denominated, no currency conversion on this portion. Diversifies
      your settlement risk across TASE and international exchanges.

  Phase 2:
    • Set up ₪2,000/mo standing order to IBI
    • Monthly allocation: 60% VWRA, 20% AGGU, 20% קרן מחקה S&P 500

  Target allocation: 80% equity / 20% bonds.

  Anything you'd like to adjust?

You: make it 100% equity, skip bonds entirely

Agent: Dropping bonds and redistributing. Since you already said you're
  comfortable with moderate risk, I want to flag: without bonds, a bad
  year could hit 20-25% instead of 15%. You have the timeline to recover,
  but make sure you're okay with that.

  Updated plan:

  Phase 1:
    • Buy ₪50,000 VWRA — global equity (was ₪45,000)
    • Buy ₪25,000 קרן מחקה S&P 500 — local fund (was ₪15,000)
    • [removed] AGGU

  Phase 2:
    • Set up ₪2,000/mo: 67% VWRA, 33% קרן מחקה S&P 500

  Target allocation: 100% equity. No bonds.

  Anything else?

You: looks good

Agent: Plan saved.
```

This story shows a pure `adjust` — the user's feedback ("skip bonds, 100% equity") can be resolved entirely with existing research. The agent uses `remove_step` (AGGU) and `update_step` (VWRA and קרן מחקה allocations) without re-entering Stage 2. No new searches needed.

---

## Story 3: User pushes back — iteration with re-research

```
$ lazy-advisor "Invest ₪35,000, I'm 25, aggressive risk tolerance"

⚠️  Disclaimer...

Agent: A few questions to fill in the picture:
  1. What's your timeline for this money?
  2. Do you have an emergency fund?
  3. Any debt?
  4. How much can you invest monthly?
  5. Do you have a brokerage account?

You: long-term, yes emergency fund, no debt, maybe ₪1,500/mo, no brokerage

Agent: Researching aggressive portfolios for your profile...
  ✓ Searched "aggressive ETF portfolio Israeli investor 2026"
  ✓ Searched "Israeli brokerages 2026 international ETF access"

  "Aggressive" at 25 makes sense — you have 35+ years for your money to
  compound, which means you can ride out the big drops that come with
  higher-risk investments. The tradeoff: your portfolio will swing more
  in the short term, but historically aggressive portfolios significantly
  outperform conservative ones over long horizons.

Plan: "Aggressive growth portfolio — ₪35,000"

  Phase 1:
    • Open a Meitav investment account

  Phase 2:
    • Buy ₪21,000 VWRA — global equity (your broad foundation)
    • Buy ₪10,500 EIMI — iShares Core MSCI Emerging Markets (accumulating, Irish)
      Emerging markets (China, India, Brazil, Taiwan) are riskier than
      developed markets but have higher growth potential. 0.18% ER.
      The risk? Political instability, currency swings, and regulatory
      surprises. That's why it's only 30%, not 60%.
    • Buy ₪3,500 SXRV — iShares Automation & Robotics (accumulating, Irish)
      Concentrated bet on tech/automation — semiconductors, AI, robotics.
      0.40% ER, pricier than VWRA, but targets the highest-growth sectors.

  Phase 3:
    • Set up ₪1,500/mo: 60% VWRA, 30% EIMI, 10% SXRV

  No bonds. At 25 with aggressive risk tolerance, you don't need the
  cushion — and every shekel in bonds is a shekel not compounding in
  equities.

  Anything you'd like to adjust?

You: I don't want emerging markets, I want more tech

Agent: That changes the investment mix — I need to research tech ETFs I
  haven't looked at yet. Give me a moment.
  ✓ Searched "best tech ETF Irish accumulating 2026 expense ratio"

  Dropping EIMI and adding tech exposure. Here's what I'd recommend:

  Updated Phase 2:
    • Buy ₪17,500 VWRA — global equity
      Still keeping this as your base. VWRA already has ~25% tech
      (Apple, Microsoft, Google are its top holdings), so even your
      "broad" fund is tech-heavy.
    • Buy ₪10,500 IUIT — iShares S&P 500 Info Tech (accumulating, Irish)
      Pure tech — Apple, Microsoft, NVIDIA, Broadcom. 0.15% ER.
      Heavier on enterprise tech compared to semiconductor-only funds.
    • Buy ₪7,000 SXRV — Automation & Robotics (was ₪3,500)
      Kept from the original plan. Tech + automation together give you
      full tech stack coverage.

  Phase 3:
    • Set up ₪1,500/mo: 50% VWRA, 30% IUIT, 20% SXRV

  Fair warning: with IUIT + SXRV + VWRA's natural tech weighting, roughly
  60% of your money is in tech. If the tech sector has a bad year (like
  2022, when the NASDAQ dropped 33%), you'll feel it a lot more than the
  broad market. That's the tradeoff with concentration — bigger wins in
  good times, bigger pain in bad times.

  You said aggressive, so this fits. But I want you going in with eyes open.

  Anything else?

You: that's what I want, go for it

Agent: Plan saved.
```

---

## Story 4: Unrealistic expectations

```
$ lazy-advisor "I have ₪18,000 and I want to double it in 6 months"

⚠️  Disclaimer...

Agent: I want to be upfront with you — doubling your money in 6 months means
  a 100% return. To put that in context:

  • Global stock markets average about 10% per year
  • The best year in the last decade was about 30%
  • To get 100% in 6 months, you'd need speculative trading — options,
    meme stocks, crypto. That's not investing, it's gambling. Some people
    win, but most lose money, and it's outside what this tool does.

  What ETF investing actually looks like:
  • ₪18,000 invested at 10% average return = ~₪47,000 in 10 years, ~₪121,000 in 20 years
  • Add ₪700/mo and those numbers become ~₪155,000 in 10 years, ~₪530,000 in 20 years
  • That's the power of compound growth — it's slow at first, then accelerates

  The "lazy investor" approach isn't about getting rich quick. It's about
  getting rich slowly and reliably.

  Want me to plan a realistic long-term strategy?

You: ok fine, long term then, moderate risk

Agent: Great — a few more things so I can tailor this:
  1. How old are you?
  2. Do you have an emergency fund?
  3. Any debt?
  4. How much can you invest monthly?
  5. Do you have a brokerage account?

You: 24, yes to emergency fund, no debt, maybe ₪700/mo, no brokerage

Agent: Researching...
  ✓ Searched "best ETF portfolio Israeli investor beginner ₪18,000 2026"

Plan: "Starter portfolio — ₪18,000"

  Phase 1:
    • Open a Meitav investment account

  Phase 2:
    • Buy ₪11,000 VWRA — global equity (accumulating, Irish)
    • Buy ₪7,000 קרן מחקה S&P 500 — local Israeli index fund

  Phase 3:
    • Set up ₪700/mo: 60% VWRA, 40% קרן מחקה S&P 500

  At ₪18,000 I'm keeping this to two funds. Adding bonds at this size would
  mean tiny positions that don't move the needle. When you pass ₪50-60k,
  adding AGGU (bonds) starts to make sense as a risk cushion.

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
  return. If NVIDIA goes up 200%, you benefit (it's in VWRA and IUIT). If
  it crashes, it's a tiny slice of your portfolio, not the whole thing.

  If you're excited about the semiconductor space specifically, I can plan
  an ETF portfolio that includes semiconductor exposure — you get the
  upside of the sector without betting on a single company.

  Want me to build a portfolio with semiconductor exposure?

You: yeah sure, I have ₪30,000, long term, I'm ok with risk

Agent: Before I research, a few quick questions:
  1. How old are you?
  2. Emergency fund in place?
  3. Any debt?
  4. How much can you invest monthly?
  5. Do you have a brokerage account?

You: 29, yes, no debt, ₪1,000/mo, no brokerage

Agent: Researching...
  ✓ Searched "semiconductor ETF Irish accumulating 2026 SXRV comparison"
  ✓ Searched "Israeli brokerages 2026 international ETF fees"
  ...
```

---

## Story 6: Search returns weak or mixed results

```
$ lazy-advisor "I want to invest ₪75,000 with focus on clean energy ETFs"

⚠️  Disclaimer...

Agent: I like the direction. A few questions first:
  1. How old are you?
  2. What's your timeline?
  3. Risk tolerance — conservative, moderate, or aggressive?
  4. Emergency fund in place?
  5. Any debt?
  6. How much can you invest monthly?
  7. Do you have a brokerage account?

You: 31, long-term (10+ years), moderate, yes emergency fund, no debt,
     ₪1,500/mo, no brokerage

Agent: Solid position. Let me research clean energy options.
  ✓ Searched "best clean energy ETFs 2026 Irish accumulating expense ratio"
  ✓ Searched "ICLN INRG clean energy ETF comparison 2026 performance"

  I want to be transparent with you about what I found.

  Clean energy ETFs exist, but they've had a rough stretch:
    • INRG (iShares Global Clean Energy, Irish-domiciled) — 0.65% ER, the
      accumulating version of ICLN. Down about 35% from its 2021 peak. High
      expense ratio compared to broad market ETFs (3x more than VWRA's 0.22%).
    • Both clean energy options have significantly lagged VWRA over the past
      3 years.

  Why? Clean energy companies often aren't profitable yet, they depend on
  government subsidies that can change with elections, and rising interest
  rates in 2022-2024 hit growth sectors hard.

  Does that mean clean energy is a bad investment? Not necessarily — it
  could be a long-term winner as the world transitions. But the higher
  fees and volatile track record mean I wouldn't put your whole ₪75,000 there.

  My recommendation: clean energy as a "tilt" (20-25%) on top of a
  diversified core. That way if clean energy takes off, you benefit. If
  it doesn't, VWRA and AGGU carry your portfolio.

  Want me to plan it that way?

You: yes, maybe 25% clean energy

Agent: Plan:

  Phase 1:
    • Open a Meitav investment account

  Phase 2:
    • Buy ₪33,750 VWRA — your broad global foundation (0.22% ER)
    • Buy ₪22,500 AGGU — global bonds, stability cushion (0.10% ER)
    • Buy ₪18,750 INRG — your clean energy tilt (0.65% ER)
      Going with INRG over ICLN because it's the Irish accumulating version —
      same holdings but better tax efficiency for Israeli investors.

  Phase 3:
    • Set up ₪1,500/mo: 45% VWRA, 30% AGGU, 25% INRG

  Your blended expense ratio is about 0.30% — higher than a pure
  diversified portfolio but still reasonable. You're paying about ₪225/year
  per ₪75,000.

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
  - Are we talking thousands, tens of thousands, or more?
  - Are you in your 20s, 30s, 40s?
  - Will you need this money in the next 2 years, or can you leave it alone?

You: like ₪10,000, I'm 30, don't need it for a while

Agent: Almost there — a few more so I don't steer you wrong:
  - Do you have some savings set aside for emergencies?
  - Any debt (student loans, credit card, etc.)?
  - Can you put in anything monthly, even a small amount?
  - If your ₪10,000 dropped to ₪8,000 in a bad month, would you panic or shrug?

You: yeah I have savings, no debt, maybe ₪300/mo, I'd probably shrug

Agent: Great — that's everything I need. Researching...
  ✓ Searched "simple ETF portfolio Israeli investor ₪10,000 beginner 2026"

  At ₪10,000 I'm going to keep this as simple as possible — one fund. Not
  because diversification doesn't matter, but because splitting ₪10,000 into
  three tiny positions adds complexity without much benefit at this size.
  As your balance grows, we can split it up.

Plan: "Simple starter portfolio — ₪10,000"

  Phase 1:
    • Open a Meitav investment account

  Phase 2:
    • Buy ₪10,000 VWRA — Vanguard FTSE All-World (accumulating, Irish)
      One fund that holds over 3,700 stocks across the entire world —
      US, Europe, Japan, emerging markets, everything. 0.22% ER. You
      own a slice of the global economy in a single purchase. The
      accumulating structure gives you tax-efficient dividend reinvestment.

  Phase 3:
    • Set up ₪300/mo standing order to Meitav and buy VWRA
      Consistency matters more than amount — ₪300/mo is ₪3,600/year of
      new shares. It adds up.

  When your balance passes ₪40-50k, it makes sense to split into separate
  funds for more control over your equity/bond mix. But right now, VWRA
  gives you everything in one place.

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

  Let me ask it this way: you invest ₪40,000 and six months later it's worth
  ₪32,000. What do you do?
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
  6. How much can you invest monthly?
  7. Do you have a brokerage account?

You: ₪45,000, I'm 33, at least 5 years, yes emergency fund, no debt,
     ₪1,000/mo, no brokerage

Agent: Researching...
  ✓ Searched "moderate risk ETF portfolio Israeli investor 2026"

Plan: "Moderate growth portfolio — ₪45,000"

  Phase 1:
    • Open a Meitav investment account

  Phase 2:
    • Buy ₪22,500 VWRA — global equity (your growth portion)
    • Buy ₪11,250 AGGU — global bonds (your stability portion)
    • Buy ₪11,250 קרן מחקה S&P 500 — local Israeli index fund

      The 25% bond allocation is what makes this "moderate" instead of
      "aggressive." In the 2022 bear market, a 75/25 stock/bond portfolio
      dropped about 15% while 100% stocks dropped 20%. That 5% difference
      doesn't sound like much, but on ₪45,000 it's the difference between
      losing ₪6,750 vs ₪9,000. More importantly, it's the difference
      between holding on and panic selling.

  Phase 3:
    • Set up ₪1,000/mo: 50% VWRA, 25% AGGU, 25% קרן מחקה S&P 500

  Anything you'd like to adjust?
```

---

## Story 9: Mid-session risk tolerance correction — backtracking through the pipeline

```
$ lazy-advisor "I'm 32, have ₪90,000 to invest, long-term, aggressive risk"

⚠️  Disclaimer...

Agent: Good detail — just a few more:
  1. Emergency fund in place?
  2. Any debt?
  3. How much can you invest monthly?
  4. Do you have a brokerage account?

You: yes emergency fund, no debt, ₪2,500/mo, no brokerage

Agent: Researching aggressive portfolios for Israeli investors...
  ✓ Searched "aggressive ETF portfolio Israeli investor 2026"
  ✓ Searched "emerging markets tech ETF Irish accumulating 2026"

Plan: "Aggressive growth portfolio — ₪90,000"

  Phase 1:
    • Open a Meitav investment account

  Phase 2:
    • Buy ₪45,000 VWRA — global equity (your broad foundation)
    • Buy ₪22,500 EIMI — emerging markets (China, India, Brazil, Taiwan)
      Higher growth potential, higher volatility. Political instability
      and currency swings are the tradeoff.
    • Buy ₪13,500 IUIT — S&P 500 Info Tech (accumulating, Irish)
      Concentrated tech bet — NVIDIA, Apple, Microsoft, Broadcom.
    • Buy ₪9,000 SXRV — Automation & Robotics (accumulating, Irish)
      Niche exposure to AI/automation/semiconductors.

  Phase 3:
    • Set up ₪2,500/mo: 50% VWRA, 25% EIMI, 15% IUIT, 10% SXRV

  No bonds. 100% equity with heavy tilts toward emerging markets and tech.

  In a bad year, this portfolio could drop 30-35%. In 2022, a portfolio like
  this would have lost roughly ₪27,000-₪31,500 of your ₪90,000. In a 2008-
  level crash, you could be looking at ₪36,000-₪45,000 in temporary losses.
  The historical recovery time for aggressive portfolios is 2-4 years.

  You said aggressive, so this fits — but I want you seeing these numbers
  before you commit.

  Anything you'd like to adjust?

You: wait, seeing those potential losses... ₪30,000 gone in a bad year?
     I think I'm actually more moderate. I couldn't stomach that.

Agent: That's a really important realization — it's better to discover this now
  than during an actual crash when the pressure to sell is real.

  Changing from aggressive to moderate means a different fund mix — I need to
  research moderate allocations that include bonds for stability. Give me a
  moment.
  ✓ Searched "moderate risk ETF portfolio Israeli investor 2026 bonds"
  ✓ Searched "AGGU global bond ETF Israeli tax efficiency"

  The big change: we're adding bonds and dropping the concentrated bets.
  Fewer funds, lower volatility, smoother ride.

Updated Plan: "Moderate growth portfolio — ₪90,000"

  Phase 1:
    • Open a Meitav investment account

  Phase 2:
    • Buy ₪45,000 VWRA — global equity (same allocation, still your core)
    • Buy ₪18,000 AGGU — global bonds (accumulating, Irish)
      Your new stability cushion. In the same 2022 scenario, AGGU would
      have softened the blow — a 75/25 stock/bond split historically drops
      15% instead of 30%+. On ₪90,000, that's ₪13,500 vs ₪27,000+ in
      temporary losses. Much more manageable.
    • Buy ₪18,000 קרן מחקה S&P 500 — local Israeli index fund
      Replacing the concentrated tech/emerging bets with stable US large-cap
      exposure. Lower risk, lower expense, shekel-denominated.
    • Buy ₪9,000 VWRA (additional) — bringing total VWRA to ₪54,000
      ...actually, let me simplify. Here's the clean version:

    • Buy ₪54,000 VWRA — global equity (60%)
    • Buy ₪18,000 AGGU — global bonds (20%)
    • Buy ₪18,000 קרן מחקה S&P 500 — local index fund (20%)

  Phase 3:
    • Set up ₪2,500/mo: 60% VWRA, 20% AGGU, 20% קרן מחקה S&P 500

  Target allocation: 80% equity / 20% bonds.

  In a bad year, this portfolio might drop 15% — about ₪13,500 instead of
  ₪30,000+. Still not fun, but recoverable in 1-2 years historically. Much
  more aligned with how you actually feel about risk.

  Anything you'd like to adjust?

You: yes, this is much better. go with it

Agent: Plan saved.
```

This story shows `research_and_adjust` triggered by a risk tolerance correction. The user initially claimed aggressive but after seeing concrete loss scenarios (₪30,000 in a bad year), they realized they're actually moderate. The agent recognizes that changing from aggressive to moderate invalidates the previous research — an aggressive portfolio with emerging markets and concentrated tech bets is fundamentally different from a moderate portfolio with bonds. The agent loops back through Stage 2 with the updated risk profile before rebuilding the plan in Stage 3.

---

## Story 10: Iteration limit reached

```
$ lazy-advisor "I'm 26, ₪45,000, aggressive, long-term"

⚠️  Disclaimer...

Agent: A few quick questions:
  1. Emergency fund in place?
  2. Any debt?
  3. How much can you invest monthly?
  4. Do you have a brokerage account?

You: yes, no debt, ₪1,500/mo, no brokerage

Agent: Researching...
  ✓ Searched "aggressive ETF portfolio Israeli investor 2026"
  ✓ Searched "Israeli brokerages 2026 best for international ETFs"

Plan: "Aggressive growth portfolio — ₪45,000"

  Phase 1:
    • Open a Meitav investment account

  Phase 2:
    • Buy ₪27,000 VWRA — global equity
    • Buy ₪11,250 EIMI — emerging markets
    • Buy ₪6,750 SXRV — automation & robotics

  Phase 3:
    • Set up ₪1,500/mo: 60% VWRA, 25% EIMI, 15% SXRV

  Anything you'd like to adjust?

You: drop emerging markets, more global
                                          [Iteration 1 — adjust]

Agent: Updated:
  Phase 2:
    • Buy ₪36,000 VWRA — global equity (was ₪27,000)
    • [removed] EIMI
    • Buy ₪9,000 SXRV — automation & robotics (was ₪6,750)

  Phase 3:
    • Set up monthly: 80% VWRA, 20% SXRV

  Anything else?

You: actually add some Israeli exposure, maybe 20%
                                          [Iteration 2 — adjust]

Agent: Updated:
  Phase 2:
    • Buy ₪27,000 VWRA — global equity
    • Buy ₪9,000 קרן מחקה S&P 500 — local Israeli index fund
    • Buy ₪9,000 SXRV — automation & robotics

  Phase 3:
    • Set up monthly: 60% VWRA, 20% קרן מחקה, 20% SXRV

  Anything else?

You: what about clean energy instead of automation?
                                          [Iteration 3 — research_and_adjust]

Agent: That's a different sector — let me look into it.
  ✓ Searched "clean energy ETF Irish accumulating 2026 INRG performance"

  I'd go with INRG (iShares Global Clean Energy, Irish accumulating, 0.65% ER).
  Fair warning: clean energy ETFs have been volatile — INRG is down ~35% from
  its 2021 peak. At your age you can ride that out, but it's a rougher ride
  than automation.

  Updated:
  Phase 2:
    • Buy ₪27,000 VWRA — global equity
    • Buy ₪9,000 קרן מחקה S&P 500 — local
    • Buy ₪9,000 INRG — clean energy (was SXRV)

  Phase 3:
    • Set up monthly: 60% VWRA, 20% קרן מחקה, 20% INRG

  Anything else?

You: hmm go back to automation, but make it a smaller position
                                          [Iteration 4 — adjust]

Agent: Updated:
  Phase 2:
    • Buy ₪31,500 VWRA — global equity
    • Buy ₪9,000 קרן מחקה S&P 500 — local
    • Buy ₪4,500 SXRV — automation & robotics

  Phase 3:
    • Set up monthly: 70% VWRA, 20% קרן מחקה, 10% SXRV

  Anything else?

You: actually can you look into AI-focused ETFs instead?
                                          [Iteration 5 — limit reached]

Agent: We've been through several rounds — here's your current plan. I'd
  suggest going with what we have. You can always start a new session to
  explore a different direction.

  Final plan:

  Phase 1:
    • Open a Meitav investment account

  Phase 2:
    • Buy ₪31,500 VWRA — global equity
    • Buy ₪9,000 קרן מחקה S&P 500 — local Israeli index fund
    • Buy ₪4,500 SXRV — automation & robotics

  Phase 3:
    • Set up ₪1,500/mo: 70% VWRA, 20% קרן מחקה, 10% SXRV

  Plan saved.
```

This story shows the iteration limit (max 5) being reached. The user keeps going back and forth — mix of `adjust` (iterations 1, 2, 4) and `research_and_adjust` (iteration 3). On the 5th attempt, the agent presents the current plan as final instead of processing another change. The plan was already persisted on iteration 4's `plan_complete`, so nothing is lost.

---

## Story 11: Search failure — pipeline hard stop

```
$ lazy-advisor "I'm 27, ₪35,000, moderate risk, long-term"

⚠️  Disclaimer...

Agent: A few quick questions:
  1. Emergency fund in place?
  2. Any debt?
  3. How much can you invest monthly?
  4. Do you have a brokerage account?

You: yes, no debt, ₪1,200/mo, no brokerage

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

## Story 12: Advanced Israeli investor

```
$ lazy-advisor "I have ₪200,000 to invest, I already know the basics"

⚠️  Disclaimer...

Agent: Great — a few questions to understand your situation:
  1. How old are you?
  2. What's your timeline?
  3. Risk tolerance?
  4. Emergency fund and debt status?
  5. How much can you invest monthly?
  6. Do you have a brokerage account?
  7. What's your investing experience?

You: 34, long-term 20+ years, moderate-to-aggressive, emergency fund yes,
     no debt, ₪5,000/mo, I have Interactive Brokers. I've been investing
     for a few years — I know about Irish ETFs, tax efficiency, the basics.
     I'm currently considering VWRA vs a CSPX+VXUS split.

Agent: Good — since you're already familiar with the landscape, I'll skip
  the basics and focus on the decision points that actually matter at your
  level.

  Let me research the current state of your specific question.
  ✓ Searched "VWRA vs CSPX VXUS split 2026 performance tracking difference"
  ✓ Searched "Irish accumulating ETF small cap value tilt 2026"
  ✓ Searched "AGGU vs IGLA bond ETF duration comparison Israeli investor"

  On your VWRA vs CSPX+VXUS question:

  The split gives you control over your US/international ratio. VWRA is
  market-cap weighted (~60% US right now). If you believe the US is
  overvalued relative to international markets, a split lets you underweight
  it. If you want to overweight US, same thing.

  The tradeoff: two funds means two trades per month, slightly more work,
  and potential tracking difference between the funds. VWRA is simpler and
  eliminates rebalancing decisions entirely.

  At ₪200k with ₪5,000/mo, the complexity of a split is manageable. But the
  real question is: do you have a view on US vs international weighting? If
  not, VWRA's market-cap weighting is the neutral default. Don't split just
  for the sake of splitting.

  One more consideration at your portfolio size: factor tilts.

  Small-cap value (ZPRV — SPDR MSCI USA Small Cap Value, Irish, 0.30% ER)
  has historically outperformed broad market over 20+ year periods by 2-3%
  annually. The catch: it underperforms for stretches of 5-10 years, and the
  last decade has been one of those stretches. With your 20-year horizon,
  you can ride that out — but you need to commit and not bail after 5 years
  of underperformance.

  Want me to include a small-cap value tilt, or keep it simpler?

You: I'll stick with VWRA for simplicity. Add a small-cap tilt, maybe 15%.
     And I want some bond allocation — maybe 15% AGGU.

Agent: Good choices. Here's the plan:

Plan: "Growth portfolio with factor tilt — ₪200,000"

  Phase 1:
    • Using your existing Interactive Brokers account

  Phase 2:
    • Buy ₪140,000 VWRA — global equity core (70%)
      Market-cap weighted global exposure. You know this fund — it's the
      simplest way to own the world. 0.22% ER.

    • Buy ₪30,000 ZPRV — MSCI USA Small Cap Value (15%)
      Your factor tilt. Historically 2-3% annual premium over broad market
      across full cycles. 0.30% ER. Expect multi-year stretches of
      underperformance — that's the price of the long-term premium.
      Don't touch this allocation when it lags.

    • Buy ₪30,000 AGGU — global bonds (15%)
      Stability portion. At moderate-to-aggressive with 15% bonds, a 2022-
      level crash hits you for ~20% instead of ~25%. Enough cushion to
      stay invested, not so much that it drags long-term returns. 0.10% ER.

  Phase 3:
    • Set up ₪5,000/mo: 70% VWRA, 15% ZPRV, 15% AGGU
      You know the drill with IB — manual orders, no auto-invest. With
      three funds, consider quarterly rebalancing if any position drifts
      more than 5% from target.

  Target allocation: 85% equity (70% broad + 15% small-cap value) / 15% bonds.
  Blended ER: ~0.21%.

  A note on US estate tax: as an Israeli holding US-domiciled assets through
  IB, you'd be exposed to US estate tax on holdings over $60k. Since you're
  using Irish-domiciled ETFs (VWRA, ZPRV, AGGU), this doesn't apply — the
  Ireland-US treaty and Ireland's lack of estate tax mean your heirs aren't
  affected. Just something to keep in mind if you ever consider switching to
  US-domiciled funds for the lower expense ratios.

  Anything you'd like to adjust?

You: perfect, go with it

Agent: Plan saved.
```

This story shows the agent adapting to an advanced user. The knowledge level changes the interaction style: no ETF-101 explanations, direct engagement with specific fund comparisons (VWRA vs CSPX+VXUS), introduction of advanced concepts (factor tilts, US estate tax implications), and trust that the user understands the tradeoffs. The agent still provides reasoning — but at the level the user needs.

---

## What these stories show

1. **Happy path** (Story 1): Full flow — clarify, research, plan with detailed explanations so the user understands every decision. Israeli investor context from the start.
2. **Simple adjustment** (Story 2): User requests a change that can be resolved with existing research (`adjust`) — agent uses `remove_step`/`update_step` to modify the plan without re-searching.
3. **Iteration with re-research** (Story 3): User pushes back with something that requires new research (`research_and_adjust`) — agent searches for tech ETFs it hadn't looked up, then rebuilds the plan.
4. **Boundaries** (Story 4): Agent is honest about unrealistic expectations, educates on what investing actually looks like, then redirects.
5. **Scope limits** (Story 5): Agent stays in its lane (ETFs, not stock picks), explains *why* ETFs over individual stocks, and offers an alternative.
6. **Weak data** (Story 6): Agent is transparent when research is mixed, explains the underlying reasons, and recommends a balanced approach.
7. **Vague users** (Story 7): Agent handles minimal input gracefully, simplifies questions, and adapts the plan complexity to the investment size.
8. **Contradictions** (Story 8): Agent uses the contradiction as a teaching moment, explains the risk/return relationship, and helps the user discover their actual risk tolerance.
9. **Risk tolerance correction** (Story 9): User claims aggressive but after seeing concrete loss scenarios, admits they're actually moderate (`research_and_adjust`). Agent recognizes the entire research basis is invalidated — an aggressive portfolio with concentrated bets is fundamentally different from a moderate one with bonds — and rebuilds from scratch.
10. **Iteration limit** (Story 10): User keeps tweaking through a mix of `adjust` and `research_and_adjust` iterations. On the 5th attempt, the agent presents the current plan as final. Demonstrates graceful degradation when the user can't settle on a direction.
11. **Search failure** (Story 11): Search API is down — all 3 retries fail. Pipeline hard-stops at Stage 2. No plan generated, no data persisted. Demonstrates the code-level safety gate that prevents unverified recommendations.
12. **Advanced investor** (Story 12): Experienced Israeli investor with Interactive Brokers. Agent skips basics, engages on specific fund comparisons, introduces factor tilts and estate tax considerations. Shows the agent adapting its depth to the user's knowledge level.

The agent is educational throughout — every recommendation comes with reasoning. The user doesn't just get a plan, they understand *why* each piece is there. That's the "lazy investor" philosophy: understand once, then trust the process.
