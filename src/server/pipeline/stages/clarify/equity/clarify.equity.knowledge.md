# Equity phase — knowledge content

Reference content used by the equity phase to help a beginner choose which instrument(s) fill the equity portion of their portfolio. Loaded into the phase prompt at module init so the LLM can answer in-conversation Q&A without web search or improvisation.

**Tone:** humble, beginner-friendly. The equity option space is wider than the buffer's — there are real tradeoffs between diversification, concentration, currency, and tax — but a beginner doesn't need to master all of it. This content covers what a lazy investor needs in order to make a choice they'll stick with through drops. If a user asks about something not covered here (specific tickers, current fees, individual stock picking, options/leverage, currency hedging mechanics, exact historical returns), defer rather than improvise.

**Staleness rule:** no specific tickers, no specific current fees, no specific recent return numbers (e.g., "S&P 500 returned X% over the past decade"). Stable historical reference points are allowed — named bear markets and their approximate drawdown magnitudes don't change. Treaty rates and legal thresholds are also stable. Sector weights and index compositions drift over time, so prefer directional language ("heavily weighted in financials and technology") over specific percentages.

---

## The five anchor instruments

For the equity portion, five instruments cover the common beginner option space.

**Cores** — typically used as the primary equity holding:

1. **Single global fund** — broad-market index covering most of the world's investable equities. Three common variants: FTSE All-World, MSCI ACWI, MSCI World. The simplest path; one fund covers a market-cap-weighted basket of global companies, currently majority-US-weighted with the remainder spread across other developed (and usually emerging) markets.
2. **S&P 500** — the 500 largest US companies. US-only, large-cap. Defensible as a sole holding because of its internal sector and multinational diversification, but with explicit US-economy concentration.

**Satellites** — typically used as a small allocation alongside a core, but the user can pick any of them as 100% if it fits their view:

3. **NASDAQ-100** — 100 large-cap non-financial US companies; tech-heavy. More cyclical than the S&P 500: strong outperformance in tech-favorable periods, severe underperformance in tech-unfavorable ones. Substantially larger drawdowns.
4. **TLV-125** — the 125 largest Israeli companies. Most commonly used as a small home-market complement.
5. **Russell 2000** — 2,000 US small-cap companies. Most commonly used as a small diversification add-on covering the small-cap segment that the large-cap-weighted indices underweight.

A multi-fund **3-fund split (the "Holy Trinity")** — 60% S&P 500 + 25% Europe + 15% Emerging Markets — is also documented below as an alternative for users who want explicit regional control instead of a single global fund. The phase does not propose it proactively.

All five anchors are accessible as Irish-listed ETFs traded on TASE in shekels. Stay at the category level — specific tickers, fund variants, and management fees change, so the user picks the specific fund at their broker after settling on the category.

---

## Israeli tax context (and why Irish-listed)

For an Israeli investor who is not a US citizen, two things shape the equity decision: how the underlying Israeli capital-gains tax works, and why Irish-listed ETFs have meaningful structural advantages over US-listed equivalents.

### Israeli capital-gains tax baseline

Equity ETFs held by Israeli residents are taxed at sale:

- 25% capital-gains tax on the **real** (inflation-adjusted) gain
- Tax only at sale — accumulating Irish-listed ETFs trigger no annual tax events while held

This is the same treatment as money-market funds and bond funds (the buffer instruments). Tax is not a meaningful differentiator between equity instruments — the choice is about diversification, concentration, and stick-with-it-through-drops behavior.

### Why Irish-listed and not US-listed

Four factors typically favor Irish-listed ETFs over their US-listed equivalents (e.g., VOO, QQQ, SPY, VTI). These are independent of which index the user picks:

1. **Dividend withholding tax.** US-listed ETFs face 25% US withholding on dividends paid to Israeli residents (US-Israel tax treaty rate). Irish-listed ETFs face 15% (physical replication) or 0% (synthetic replication via SWAP). The dividend-tax differential alone compounds to roughly 0.2–0.3% per year of drag on US-listed — small per year, meaningful over decades.
2. **Distribution vs accumulating structure.** US-listed ETFs distribute dividends as cash, which creates a taxable event in Israel each year even without selling. Irish-listed accumulating ETFs reinvest dividends inside the fund — no annual tax event; tax only triggers when the user sells. The dividends compound tax-free in the meantime.
3. **US estate exposure.** US-listed ETFs are US-situs assets. For non-US-citizens, holdings above $60,000 are exposed to US estate tax (graduated rates up to 40%). Irish-listed ETFs are exempt.
4. **Currency friction.** US-listed requires shekel↔USD conversion at each trade and on each distributed dividend. Irish-listed on TASE is shekel-native — no recurring forex cost.

US-listed ETFs do have small structural advantages (slightly lower expense ratios — a few basis points typically — and tighter bid/ask spreads). For a buy-and-hold investor over multi-year horizons, the four factors above typically dominate the small US-listed advantages.

If a user names a US-listed instrument, surface the four factors once, then accept the user's final answer. US-listed isn't *wrong* — it's tax-inefficient for most non-US-citizen Israelis, and the user has final say on whether they want to take that on.

---

## Single global fund options

A "single global fund" is the simplest equity path: one ETF covering most of the world's investable companies, weighted by market cap. The fund decides geographic and sector allocation based on actual market sizes, so the user doesn't need to make per-region calls.

Three common variants. The primary decision between them is **whether the user wants emerging-market exposure** (China, India, Brazil, Taiwan, etc.):

- **FTSE All-World** — includes developed *and* emerging markets. Broadest holdings count; lowest fees of the three. The most common pragmatic default.
- **MSCI ACWI** — also includes developed *and* emerging markets. Similar in spirit to FTSE All-World; fewer holdings; slightly higher fees. Methodology differences are minor for a beginner.
- **MSCI World** — developed markets *only*; no emerging markets. Slightly more US-concentrated as a result. Some prefer this if they want to avoid emerging-market volatility or geopolitical exposure.

If the user has no strong view, **FTSE All-World** is the most common default — broadest exposure with the lowest fees among the three.

**Character note.** A single global fund is naturally market-cap weighted, so the current US weight reflects today's US market dominance. That weight has been very different historically (the US was around a third of global equity in the 1970s) and will drift as global markets evolve. The user is not "betting on the US" by holding one of these — they are holding the world as it currently is, and the index will rebalance itself as that changes.

---

## S&P 500

The S&P 500 is the 500 largest US-listed companies. It is **defensible as a sole equity holding** for two reasons:

- **Sector diversification.** The index spans technology, healthcare, financials, consumer goods, industrials, energy, and more — not concentrated in one industry.
- **Multinational diversification.** Many S&P 500 companies (Apple, Microsoft, Coca-Cola, Procter & Gamble, etc.) earn a large share of revenue outside the US. Holding the S&P 500 gives indirect exposure to global consumer and business markets through US-headquartered multinationals.

**Character note.** In recent years, the S&P 500's behavior has been increasingly driven by a small number of mega-cap technology companies — the top holdings are a meaningfully larger share of the index than they were a decade ago. The index reflects the fortunes of those specific companies more than people sometimes realize.

**Pension overlap caveat (Israeli investors).** Many Israelis have actively chosen a `מסלול S&P 500` track in their pension or `קרן השתלמות` — it has been a popular opt-in since around 2020. If that's the case for the user, they may already hold meaningful S&P 500 exposure there, and adding more in their self-directed account creates concentration on top of concentration. The phase surfaces this once when the user picks S&P 500 alone, then accepts whatever they decide.

**Drawdown context.** The S&P 500 has had drawdowns around 50% in major bear markets (notably the 2008 financial crisis), with multi-year recovery times. A user choosing S&P 500 should be prepared for this magnitude of drop occurring at some point during a long holding period.

---

## NASDAQ-100

The NASDAQ-100 is 100 large-cap non-financial companies listed on the NASDAQ exchange — heavily tech-tilted by composition. Its top holdings are mostly the same handful of mega-cap tech names (Apple, Microsoft, Google/Alphabet, Amazon, NVIDIA, Meta, Tesla) that dominate the S&P 500's top, but at much higher concentration: those top names are a much larger share of the NASDAQ-100 than they are of the S&P 500.

**Character note.** NASDAQ-100 is best understood as a concentrated bet on US large-cap technology and the broader narrative around tech innovation (cloud, AI, software, etc.). Its fortunes are closely tied to that sector's cycles — it has had stretches of strong outperformance vs the S&P 500 (notably the past decade) and stretches of severe underperformance (the 2000s). Holding NASDAQ-100 alongside an S&P 500 or global fund creates double-counting on the same tech exposure — those names are already a large share of the broader indices.

**Drawdown context.** NASDAQ-100 has had substantially larger drawdowns than the S&P 500. The most striking historical example is the 2000–2002 dot-com bust, in which the index fell roughly 80% peak-to-trough and took approximately 14 years to fully recover its earlier high. It also fell sharply in 2008 (around 40%) and 2022 (around 30%). A user choosing NASDAQ-100 needs to be prepared for drawdowns of that magnitude.

**Typical use.** 5–20% as a satellite alongside a core. Users with strong tech conviction sometimes pick it as a larger allocation, including 100%; the phase surfaces the concentration tradeoff once in that case, then accepts the user's final answer.

---

## TLV-125

The TLV-125 (also called TA-125) is the 125 largest companies listed on the Tel Aviv Stock Exchange — the broadest commonly-tracked Israeli equity index. It is heavily weighted in financials (largely banks) and technology, with the remainder spread across real estate, commerce, and industrials.

**Character note.** Israel is a small economy in global terms, so single-company moves can have a larger impact on the index than in broader global indices. The index is also exposed to Israel-specific geopolitical and regulatory risk in ways that global indices are not.

**Why some Israelis hold it as a small position:**

- **Shekel-revenue exposure.** Israeli companies earn revenue primarily in shekels, so the value of TLV-125 holdings is less affected by shekel-vs-dollar currency moves than US-listed equity is.
- **Familiarity / home bias.** Some prefer holding companies they encounter in local news and daily life.
- **Domestic valuation.** At various times, Israeli equity has traded at lower price-to-earnings multiples than US equity — though valuation gaps can persist for long periods, so this is not a reliable timing signal.

**Typical use.** A small home-market complement, generally well below the size of the user's core holding. A user who picks TLV-125 as their entire equity allocation is taking on small-economy concentration risk; the phase surfaces the tradeoff once and accepts the user's answer.

---

## Russell 2000

The Russell 2000 is 2,000 US small-cap companies — the standard benchmark for US small-cap equity. It complements an S&P 500 or global-fund holding by covering the small-cap segment that those large-cap-weighted indices underweight.

**Character note.** Small-cap companies tend to be **more rate-sensitive than large-caps** because they typically rely more on debt financing for growth. Their performance is more closely tied to interest-rate cycles — they tend to do better when rates fall (cheaper financing) and worse when rates rise. This is a description of the instrument's behavior, not a buying signal: lazy investors don't time markets based on rate forecasts. The rate-sensitivity is part of why Russell 2000 is more volatile than the S&P 500 in general.

**Historical note.** Over the past two decades, the long-run small-cap "premium" has not reliably materialized. Russell 2000 has underperformed the S&P 500 over multi-decade rolling periods despite higher volatility. The small-cap premium is a contested topic in academic finance — useful to know that the case for small-caps is not as well-established as a beginner might assume.

**Drawdown context.** Russell 2000 drawdowns in major bear markets have been comparable to or larger than S&P 500 drawdowns (often 40–50% in 2008 and 2022).

**Typical use.** A small diversification add-on for users who specifically want small-cap exposure as a portfolio completer. Picking Russell 2000 as a primary holding is unusual for beginners and warrants a sanity check.

---

## Synthetic vs physical replication

Most Irish ETFs use one of two structures to track their index:

- **Physical replication** (most iShares funds; e.g., the standard FTSE All-World tracker). The fund actually holds the underlying stocks. Pays 15% withholding to the US on US-stock dividends. Standard, well-understood structure.
- **Synthetic replication** (most Invesco funds; e.g., the synthetic S&P 500 or MSCI World tracker). The fund holds a SWAP contract with a large bank that pays the index return; the bank handles the underlying stock holdings on its own balance sheet. Effectively 0% dividend tax on US stocks. Tradeoff: counterparty risk if the bank fails — mitigated by daily settlement, segregated collateral, and multiple counterparties, but not zero.

For a long-term holder, the dividend-tax difference compounds to a small annual advantage favoring synthetic. Most beginners go physical for the simpler structure; some prefer synthetic for the tax efficiency. Either is reasonable. Surface the distinction only when the user is choosing between two variants of the same index, or asks why one is cheaper.

---

## Holy Trinity 3-fund split (alternative)

The "Holy Trinity" is a multi-fund equity structure: **60% S&P 500 + 25% Europe + 15% Emerging Markets**. It is positioned as an alternative to a single global fund for users who want explicit regional weights instead of letting market-cap weighting decide.

**Tradeoffs versus a single FTSE All-World or ACWI:**

- *Pros:* slightly lower aggregate fees; explicit control over emerging-market and European weights.
- *Cons:* three funds to track and rebalance instead of one; periodic rebalancing required to keep the weights from drifting; more buy/sell decisions per year; more complexity for a beginner.

For most beginners, a single global fund delivers very similar exposure with much less operational overhead. The Holy Trinity is reasonable for users who specifically want to deviate from market-cap weights — for example, those who think the natural majority-US weight is too high and want to cap it at 60%.

This phase doesn't proactively propose the 3-fund split. If a user asks about constructing a multi-fund portfolio with explicit regional weights, this is the canonical answer.

---

## What we don't cover

If a user asks about any of the topics below, acknowledge it's outside the simple lazy-investor scope and either suggest consulting their broker or an advisor, or defer it as a topic for after they've built foundational holdings:

- **Sector ETFs** (technology, semiconductors, biotech, etc. — XLK, SOXX, etc.) — too concentrated for a beginner; the lazy-investor philosophy avoids active sector tilting.
- **Individual stocks.** Picking individual companies is the opposite of lazy investing. The diversification of an index fund is what protects against single-company failure.
- **Currency hedging.** Hedged versions of equity ETFs exist (e.g., shekel-hedged S&P 500). The mechanics, costs, and implications are complex and not a beginner concern.
- **Leverage, options, margin.** Out of scope.
- **Smart-beta and factor funds** (value, momentum, quality, low-volatility, etc.). Out of scope; the lazy-investor approach is plain market-cap weighted indices.
- **Specific current expense ratios, fund-by-fund yields, exact tax brackets.** These change; the user can check current numbers at their broker before purchasing.
- **What return to expect.** Nobody can predict future returns. Stocks have historically averaged real returns somewhere in the mid-to-high single digits over multi-decade periods, but with multi-year stretches of negative returns. The lazy-investor approach is to pick something the user will stick with through drops, not to chase a specific number.
