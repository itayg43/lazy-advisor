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

## Edge case stories (condensed)

Stories 4-12 demonstrate boundary behaviors. The full dialogue is less important than the *rule* each story establishes.

### Story 4: Unrealistic expectations
**Input**: "I have ₪18,000 and I want to double it in 6 months"
**Behavior**: Agent explains why 100% in 6 months is gambling, not investing. Shows realistic compound growth numbers (₪18k → ₪47k in 10 years). Educates, then asks if user wants a realistic long-term plan. Does NOT refuse outright — redirects.
**Rule**: Unrealistic expectations → educate with numbers → redirect to realistic goals.

### Story 5: Outside scope — individual stocks
**Input**: "Should I buy NVIDIA stock?"
**Behavior**: Agent declines individual stock picks, explains why (85-90% of fund managers fail to beat market over 10 years — SPIVA data). Offers ETF alternative with sector exposure (semiconductor ETFs). Does NOT judge — explains the tradeoff and offers an alternative within scope.
**Rule**: Individual stocks → explain ETF philosophy → offer sector ETF alternative.

### Story 6: Weak search results
**Input**: "I want to invest ₪75,000 with focus on clean energy ETFs"
**Behavior**: Agent is transparent about mixed findings (INRG down 35% from 2021 peak, 0.65% ER vs VWRA's 0.22%). Explains *why* (unprofitable companies, subsidy dependence, interest rate sensitivity). Recommends clean energy as a 20-25% "tilt" on a diversified core, not the whole portfolio.
**Rule**: Weak/mixed research → be transparent about what was found → explain the underlying reasons → recommend a balanced approach.

### Story 7: Vague user
**Input**: "invest" → "idk some money" → "like ₪10,000, I'm 30"
**Behavior**: Agent progressively simplifies questions (open-ended → multiple choice → yes/no). Adapts plan complexity to investment size (₪10k = one fund, VWRA only). Explains when to diversify further (₪40-50k threshold).
**Rule**: Vague input → simplify questions iteratively → match plan complexity to portfolio size.

### Story 8: Contradictory input
**Input**: "I want maximum returns but I can't afford to lose any money"
**Behavior**: Agent uses the contradiction as a teaching moment — explains the risk/return relationship as a fundamental rule, not a flaw. Uses a concrete scenario (₪40k → ₪32k, what do you do? A/B/C) to discover actual risk tolerance. Proceeds with the discovered tolerance (moderate).
**Rule**: Contradictory goals → educate on the tradeoff → use scenarios to discover real risk tolerance.

### Story 9: Mid-session risk tolerance correction
**Input**: User claims aggressive, then sees "₪30,000 gone in a bad year" and says "I think I'm actually moderate"
**Behavior**: Agent recognizes that changing risk tolerance invalidates previous research (aggressive portfolio with concentrated tech/EM bets ≠ moderate with bonds). Triggers `research_and_adjust` — loops back through Stage 2 with updated risk profile, rebuilds plan from scratch. Does NOT just swap a few funds.
**Rule**: Risk tolerance change → `research_and_adjust` (full re-research), not just `adjust`.

### Story 10: Iteration limit reached
**Input**: User goes through 5 iterations — mix of `adjust` (1, 2, 4) and `research_and_adjust` (3). On 5th attempt asks for yet another sector change.
**Behavior**: Agent presents current plan as final: "We've been through several rounds — here's your current plan. You can start a new session anytime." Plan was already persisted from iteration 4's `plan_complete`.
**Rule**: Max 5 iterations → present current plan as final → nothing is lost (incremental persistence).

### Story 11: Search failure — pipeline hard stop
**Input**: Normal user, but search API is down.
**Behavior**: Stage 2 retries 3 times with exponential backoff, all fail. Pipeline stops at the code level — Stage 3 never runs. Error message: "I wasn't able to retrieve current financial data right now. I don't want to build a plan without verified information." No plan persisted.
**Rule**: Search failure → hard stop. This is a code-level gate, not an LLM decision — no prompt injection can bypass it.

### Story 12: Advanced Israeli investor
**Input**: "I have ₪200,000 to invest, I already know the basics" — user mentions Irish ETFs, VWRA vs CSPX+VXUS split, has Interactive Brokers.
**Behavior**: Agent detects experience level, skips ETF-101 explanations. Engages directly on specific fund comparisons, introduces advanced concepts (factor tilts with ZPRV, US estate tax implications for Irish-domiciled ETFs). Still provides reasoning, but at the user's level.
**Rule**: Advanced user → match explanation depth to knowledge level → introduce advanced concepts (factor tilts, estate tax) that wouldn't help a beginner.

---

## Story-to-stage mapping

Which stage owns each story's distinct behavior, and where it's validated:

| Story | Primary stage | Eval coverage | Notes |
|-------|---------------|---------------|-------|
| 1 (happy path) | All (1→2→3→4) | Clarify extraction eval | Full E2E deferred to Section 11 |
| 2 (simple adjustment) | 4 — Iterate | — | `adjust` without re-research |
| 3 (re-research iteration) | 4 — Iterate | — | `research_and_adjust` with new search |
| 4 (unrealistic expectations) | 1 — Clarify | Clarify full-loop eval | Educate → redirect |
| 5 (outside scope) | 1 — Clarify | — | Decline stock picks, offer ETF alternative |
| 6 (weak search results) | 2 — Research | — | Transparent about mixed findings |
| 7 (vague user) | 1 — Clarify | Clarify full-loop eval | Progressive question simplification |
| 8 (contradictory input) | 1 — Clarify | Clarify extraction + full-loop evals | Scenario-based risk discovery |
| 9 (risk correction) | 4 — Iterate | — | Risk change → `research_and_adjust` |
| 10 (iteration limit) | 4 — Iterate | — | Max 5 iterations |
| 11 (search failure) | 2 — Research | — | Code-level hard stop, no prompt bypass |
| 12 (advanced investor) | 1 — Clarify + 3 — Plan | Clarify extraction eval | Adapt depth to knowledge level |

Stories without eval coverage will gain evals in their respective section's eval task (e.g., 4.6 for research, 6.x for iterate).

## What these stories show

1. **Happy path** (Story 1): Full flow — clarify, research, plan with detailed explanations. Israeli investor context.
2. **Simple adjustment** (Story 2): `adjust` — modify plan with existing research, no re-search.
3. **Iteration with re-research** (Story 3): `research_and_adjust` — new sector requires new searches.
4. **Boundaries** (Story 4): Educate on unrealistic expectations, redirect.
5. **Scope limits** (Story 5): Decline stock picks, offer ETF alternative.
6. **Weak data** (Story 6): Transparent about mixed research, recommend balanced approach.
7. **Vague users** (Story 7): Simplify questions iteratively, match plan to portfolio size.
8. **Contradictions** (Story 8): Use contradiction to teach risk/return, discover real tolerance.
9. **Risk correction** (Story 9): Risk tolerance change triggers full re-research, not just adjust.
10. **Iteration limit** (Story 10): Max 5 iterations, present current plan as final.
11. **Search failure** (Story 11): Code-level hard stop, no plan without verified data.
12. **Advanced investor** (Story 12): Adapt depth to user's knowledge level.
