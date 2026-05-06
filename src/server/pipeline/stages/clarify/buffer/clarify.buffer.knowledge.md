# Buffer phase — knowledge content

Reference content used by the buffer phase to answer beginner questions about the safe portion of an investment portfolio. Loaded into the phase prompt at module init so the LLM can answer in-conversation Q&A without web search or improvisation.

**Tone:** humble, beginner-friendly. The bond world is genuinely complex — this content covers what a lazy investor needs, not exhaustive theory. If a user asks about something not covered here (specific yields, current rates, exact tax brackets, fund-by-fund comparisons, hedged vs unhedged mechanics, individual bond purchases, dollar-denominated bonds), defer rather than improvise specifics.

**Staleness rule:** never include specific numbers — current BoI rate, fund-specific fees, particular yields. Only mechanisms and direction.

---

## The three anchor options

For the safe portion of the portfolio, three reasonable beginner options:

1. **קרן כספית** (money market fund) — capital-stable, daily-liquid, yields tied to the BoI rate. Simplest choice. No interest-rate risk.
2. **קרן מחקה מדד אג"ח ממשלתי קצר (שקלי or צמוד מדד)** — short-term Israeli government bond fund. Lower duration than the general index. Some yield potential above קרן כספית, with modest price volatility.
3. **קרן מחקה מדד אג"ח ממשלתי כללי** — general Israeli government bond fund. Mix of short, medium, and long bonds; longer average duration. More volatile, with more real-return potential over multi-year horizons.

All three are shekel-denominated, traded on TASE, and accessible through any Israeli broker. Stay at the category level — fund availability and fees change, so the user picks a specific fund with their broker.

---

## What is אג"ח (a bond)

A bond is a loan you give to a state or company in exchange for periodic interest, with the principal returned at maturity. Bond prices fluctuate on the secondary market.

The mechanism that matters most for a beginner: **bond prices and interest rates move inversely.** When rates rise, existing bond prices fall (because new bonds offer higher yields, making old ones less attractive). When rates fall, existing bond prices rise. Longer-maturity bonds are more sensitive to rate changes than shorter ones.

---

## ממשלתי (government) vs קונצרני / חברות (corporate)

**Government bonds (ממשלתי)** are loans to the Israeli government. Considered the safest type — sovereign backing, very low default risk, lower yield to compensate.

**Corporate bonds (קונצרני, also called אג"ח חברות)** are loans to specific companies. Carry business/solvency risk: if the company fails, principal can be lost. Higher yield to compensate.

**Why we recommend government, not corporate.** Corporate bond exposure reintroduces idiosyncratic single-company risk — the same kind of concentration risk we avoid in equity by holding index ETFs instead of individual stocks. Government bond *index* funds diversify across many issuances; corporate exposure is typically less diversified. For beginners building a lazy-investor portfolio, stay government.

---

## Duration: קצר (short) vs כללי (general)

Duration is roughly the average remaining life of the bonds in a fund. Longer duration → more yield, but also more price sensitivity to interest-rate changes.

- **Short-term government bond fund (קצר)**: shorter-maturity bonds. Less price volatility, less exposure to surprise rate changes. Behaves closer to קרן כספית, with some additional yield potential.
- **General government bond fund (כללי)**: a mix of short, medium, and long bonds. Higher average duration. More volatile — long bonds can drop materially when rates rise — but more upside if rates fall or stay flat over multi-year periods.

Rule of thumb: shorter horizons or low tolerance for price drops → קצר; longer horizons with willingness to ride out volatility → כללי.

---

## שקלי vs צמוד מדד (CPI-linked)

Israeli government bond funds come in two flavors:

- **שקלי (shekel-denominated)**: fixed nominal returns. Predictable in shekel terms; loses real purchasing power if inflation rises unexpectedly.
- **צמוד מדד (CPI-linked)**: returns adjust with the Consumer Price Index. Protects real purchasing power against inflation; in low-inflation environments may underperform שקלי.

Both are reasonable. **שקלי is the simpler default.** Switch to צמוד מדד only with a specific view on inflation or an explicit need for inflation protection.

---

## Why no foreign-currency (USD-denominated) options

For the safe portion of the portfolio, stay in shekels. Foreign-currency exposure adds currency volatility on top of whatever the underlying instrument does — and currency moves can be large and unpredictable. The whole point of the safe portion is stability, so adding USD/shekel risk works against the goal.

(The equity portion is a different story — global stock ETFs carry implicit currency exposure, but they're held for long-term equity return, not for stability.)

---

## Why funds, not individual bonds

For beginners, recommend bond *funds* over buying individual bonds directly:

- Wide diversification across many issuances
- Automatic rebalancing as bonds mature and are replaced
- Tax efficiency: funds get real (inflation-adjusted) taxation; direct bonds are taxed nominally
- No reinvestment overhead

This parallels why we recommend stock ETFs over individual stocks — fund wrappers do the diversification and operational work.

---

## Tax treatment

All three options (קרן כספית, short government bond fund, general government bond fund) are taxed the same way in Israel:

- 25% capital-gains tax on the **real** (inflation-adjusted) gain
- Tax due only at sale — no annual tax events

In practice: if a fund returns more than inflation, you're taxed only on the portion above inflation. If a fund's return is at or below inflation, no tax.

**Tax is not a meaningful differentiator between the three options.** The choice is about capital stability, real return potential, and willingness to ride out price volatility.

---

## What we don't cover

If a user asks about: specific current yields, exact tax brackets, fund-by-fund comparisons, individual bond purchases, corporate bonds, dollar-denominated bonds, hedged vs unhedged mechanics, or duration math — acknowledge it's outside the simple lazy-investor scope and suggest consulting their broker or an advisor. Don't improvise specifics that change over time.
