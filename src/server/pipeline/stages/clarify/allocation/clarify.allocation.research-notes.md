# Allocation Phase — Research Notes

**Date:** 2026-04-21 (initial synthesis + web-verified pass + design decision)
**Status:** Reference document. Records the research and the design decision that came out of it. Implementation (Step 2) unblocks after user review of the Decision section below.

## Caveat on sources

This doc went through two research passes:

1. An initial synthesis from training-memory knowledge (directionally reliable, specific numbers approximate).
2. A web-verified pass using primary and industry sources, listed at the end of this doc.

The web-verified pass confirmed most of pass 1's findings, corrected two (the "4–5 anchor" count and the short-horizon anchor ranges), and surfaced two new findings (risk composure ≠ tolerance; Behavioral Portfolio Theory's mental-account framing). Load-bearing claims are tagged **[verified]** if the web pass found direct support, **[partial]** if support was suggestive but not definitive, and **[unverified]** where no direct source was located.

## Why this doc exists

Phase 4 (risk) just landed its 1–5 self-rating rewrite and delegated capacity (timeline, age, emergency fund, debt) to this phase. Phase 4b's job is to combine willingness (the `riskTolerance` bucket + optional `selfRatingScore`) with capacity into a concrete total-portfolio equity/buffer split. The `PHASE_4B_PLAN.md` hypothesis was a **five-factor anchor** with illustrative ranges keyed on risk + timeline + age + EF + debt. This doc tests that hypothesis against what the literature says good allocation-sizing practice looks like, so we don't lock in a design that's either overengineered (multi-factor when one factor dominates) or naively simple (single-variable when the literature requires willingness + capacity).

## Findings

### 1. Willingness/capacity separation is the professional norm; age-based rules are retail heuristics — **[partial]**

Kitces explicitly advocates the two-dimensional willingness (tolerance) × ability (capacity) framework and argues the two must not be collapsed into a single score ([Kitces — Separating Risk Tolerance From Risk Capacity](https://www.kitces.com/blog/separating-risk-tolerance-from-risk-capacity-just-because-you-can-afford-to-take-risk-doesnt-mean-you-should/), [Kitces — Two-Dimensional Risk Tolerance Assessment](https://www.kitces.com/blog/tolerisk-aligning-risk-tolerance-and-risk-capacity-on-two-dimensions/)). Morningstar frames age-based rules as rules-of-thumb rather than professional methodology ([Morningstar — Pinning Down Portfolio Rules of Thumb](https://www.morningstar.com/markets/pinning-down-portfolio-rules-thumb)).

**Tagged partial, not verified,** because no source I found explicitly names "age-in-bonds" or "120-minus-age" and calls it insufficient. The criticism is implicit — professional frameworks universally combine willingness with capacity, and single-variable age rules are framed as consumer shorthand. Directional conclusion holds.

### 2. Major advisors use discrete model portfolios — anchors confirmed, granularity finer than pass 1 claimed — **[verified, with correction]**

Verified anchors:

- **Vanguard LifeStrategy:** Income 20/80, Conservative Growth 40/60, Moderate Growth 60/40, Growth 80/20 ([Vanguard LifeStrategy](https://investor.vanguard.com/investment-products/mutual-funds/life-strategy-funds)).
- **iShares Core Allocation ETFs:** AOK 30/70, AOM 40/60, AOR 60/40, AOA 80/20 ([BlackRock iShares AOA](https://www.ishares.com/us/products/239729/ishares-aggressive-allocation-etf)).
- **Fidelity Asset Manager:** 7-fund ladder at 20/30/40/50/60/70/85 equity ([Fidelity Asset Manager Funds](https://www.fidelity.com/mutual-funds/fidelity-fund-portfolios/asset-manager-funds)).
- **Vanguard retail questionnaire** outputs 9 suggested allocations ([Vanguard Investor Questionnaire](https://investor.vanguard.com/tools-calculators/investor-questionnaire)).
- **FinaMetrica:** 25-item psychometric instrument mapped to an allocation band, combined with capacity ([FinaMetrica — How it Works](https://riskprofiling.com/How-it-Works)).

**Correction to pass 1:** industry norm is 7–9 anchors, not 4–5. Our 3-bucket output (inherited from Phase 4) is a conscious behavioral-anchor simplification, not a match to industry practice. Should be named as such in the rules file.

### 3. "Sizing reduces panic-selling" — directional, not causal — **[verified]**

Dalbar QAIB is a correlational observation of the dollar-weighted vs. time-weighted return gap computed from ICI fund-flow data — not a controlled study of allocation appropriateness ([DALBAR QAIB](https://www.dalbar.com/qaib/)). A Kitces-hosted critique demonstrates QAIB confounds investor behavior with market-return sequencing and does not isolate causation ([Kitces — Does DALBAR Overstate the Behavior Gap?](https://www.kitces.com/blog/does-the-dalbar-study-grossly-overstate-the-behavior-gap-guest-post/)).

Kitces separately argues panic-selling comes from unstable risk *perception* during drawdowns ("risk composure"), not miscalibrated tolerance ([Kitces — Risk Composure](https://www.kitces.com/blog/risk-composure-stability-risk-perception-predicting-investor-behavior-biases/)). Even the mechanism is contested in the literature.

**Implication:** rules-file wording should say "sizing to tolerance *tends to* reduce panic-selling" — not "eliminates" or "prevents". The behavioral safeguard premise is directional.

### 4. Timeline dominates; age is a proxy; EF/debt are prerequisite gates — **[verified]** (LOAD-BEARING)

All three sub-claims verified against primary sources:

- **(4a) Age = proxy for timeline.** Target-date funds are organized around retirement *year* (timeline), not age directly. J.P. Morgan: participants "might not fully understand their risk tolerance but can generally identify the approximate year in which they plan to retire" ([J.P. Morgan — Decoding TDF Design](https://am.jpmorgan.com/us/en/asset-management/adv/insights/retirement-insights/decoding-target-date-fund-design/)). Vanguard's TDF glide path is a linear function of years-to-retirement, not age ([Vanguard TDF glide path](https://workplace.vanguard.com/investment/strategies/tdf-glide-path.html)).
- **(4b) Emergency fund is a prerequisite gate.** Vanguard puts EF as a separate 3–6 months of cash/MMF, distinct from investment allocation ([Vanguard — Emergency Fund Guide](https://investor.vanguard.com/investor-resources-education/emergency-fund)). Bogleheads places EF as a first-priority item preceding most investing decisions ([Bogleheads — Prioritizing Investments](https://www.bogleheads.org/wiki/Prioritizing_investments)).
- **(4c) Debt is a prerequisite gate.** Bogleheads treats high-interest debt as a top-priority payoff before taxable investing, balanced against employer match and EF build ([same source](https://www.bogleheads.org/wiki/Prioritizing_investments)).

**No primary source found treating EF or debt as continuous anchor inputs to the equity/bond split.** They are universally framed as pre-investment gates.

**Design implication confirmed:** the factor table collapses from 5 factors to 2 (risk × timeline). EF and debt handled as conversational suitability qualifiers, not anchor inputs. Age dropped as redundant with timeline.

### 5. Anchor ranges — long-horizon confirmed; short-horizon much tighter than pass 1 draft — **[verified, with correction]**

- **Long-horizon (10+ yr):** Vanguard Target Retirement 2060 starts at ~90/10 and glides to ~30/70 at retirement ([Vanguard TDF glide path](https://workplace.vanguard.com/investment/strategies/tdf-glide-path.html)). Aggressive long-horizon 80–90% equity anchor confirmed across Vanguard LifeStrategy Growth (80/20), iShares AOA (80/20), and Fidelity Asset Manager 85% tier.
- **Short-horizon:**
  - **<1 year:** effectively 0% equity — cash, MMF, high-yield savings ([Vanguard — Short-term Savings Goals](https://investor.vanguard.com/investor-resources-education/short-term-savings-goals), [Fidelity — Investing for Short-Term Goals](https://www.fidelity.com/learning-center/trading-investing/investing-for-short-term-goals)).
  - **1–3 years:** dominated by short-term bonds/CDs; at most a token equity slice.
  - **3–5 years:** moderate conservative mix — 20–40% equity range, graded by tolerance.
  - Bogleheads explicitly draws the three-fund-portfolio line at ~10 years ([Bogleheads — Three-fund portfolio](https://www.bogleheads.org/wiki/Three-fund_portfolio)).

**Correction to pass 1 draft:** short-horizon anchors in the 20–60% range are wrong. **Risk tolerance is not a meaningful dial below ~3 years** — practitioners treat <3yr money as cash-equivalent regardless of tolerance. 3–5yr is where tolerance starts to matter, with a narrow 10–40% range.

### 6. Pre-stated-split early-exit — fiduciary frameworks require sanity check; our product isn't a fiduciary but industry norm favors it — **[verified]**

FINRA Rule 2111 (suitability), CFP Board's Code of Ethics, and ESMA's MiFID II suitability guidelines all require the advisor to push back on a client-directed allocation that conflicts with the client's profile — the firm cannot simply adopt a client-stated split that fails the profile test ([FINRA Rule 2111](https://www.finra.org/rules-guidance/rulebooks/finra-rules/2111), [CFP Board — Fiduciary Duty](https://www.cfp.net/ethics/compliance-resources/2018/05/focus-on-ethics---cfp-professionals-fiduciary-duty-when-providing-financial-advice), [ESMA MiFID II Guidelines](https://www.esma.europa.eu/sites/default/files/2023-04/ESMA35-43-3172_Guidelines_on_certain_aspects_of_the_MiFID_II_suitability_requirements.pdf)).

**Our context:** Lazy Advisor is not a regulated fiduciary. FINRA/CFP/MiFID don't bind us. But the industry norm favors a lightweight sanity check, and our product philosophy (user has final say, trade-offs presented honestly) is consistent with a sanity-check-then-accept pattern, not with blind acceptance.

**Design conclusion:** pre-stated-split early-exit remains the default path. When the stated split is **extreme relative to known capacity** (e.g., 100% equity with <3yr horizon, or 0% equity with 20+yr horizon and aggressive risk), the agent surfaces the mismatch in one turn, then accepts the user's final answer.

### 7. Honest limitations — verified as consistent with the literature — **[verified]**

All four limitations from pass 1 hold:

- **No past-behavior probe.** Gold standard requires longitudinal data; beginners lack it ([Kitces — Sorry State of Risk Tolerance Questionnaires](https://www.kitces.com/blog/risk-tolerance-questionnaire-and-risk-profiling-problems-for-financial-advisors-planplus-study/)).
- **No household balance sheet.** FINRA 2111 explicitly expects "other investments, financial situation and needs, tax status" — omitting them is a known simplification.
- **Point-estimate vs. distribution.** Behavioral Portfolio Theory (Shefrin/Statman) advocates mental-account sub-portfolios; single-point anchor is an approximation ([Shefrin & Statman — BPT](http://efinance.org.cn/cn/fm/Behavioral%20Portfolio%20Theory.pdf)).
- **Heuristic factor weights.** Academic instruments (Grable-Lytton, FinaMetrica) are psychometrically calibrated; our weights are not. Not a hidden defect — most retail tools carry this caveat.

### 8. New from pass 2: risk composure ≠ risk tolerance — **[verified]**

Kitces distinguishes **risk composure** (stability of risk perception over time) from **risk tolerance** (static preference). Panic-selling stems from composure instability during drawdowns, not necessarily from miscalibrated tolerance ([Kitces — Risk Composure](https://www.kitces.com/blog/risk-composure-stability-risk-perception-predicting-investor-behavior-biases/)).

**Implication for our design:** sizing to tolerance is still the best available behavioral anchor, but the rules-file narrative should frame it as "reduces the probability of panic-selling" rather than "prevents it". Phase 4's 1–5 self-rating is a tolerance measure, not a composure measure — we have no composure probe and won't invent one without evidence.

### 9. New from pass 2: Behavioral Portfolio Theory — mental-account sub-portfolios per goal — **[verified, out of scope]**

Shefrin/Statman's BPT argues households mentally segment wealth into goal-specific sub-portfolios rather than holding a unified optimal portfolio ([Shefrin & Statman — BPT](http://efinance.org.cn/cn/fm/Behavioral%20Portfolio%20Theory.pdf)). Relevant if Lazy Advisor ever multiplexes goals (retirement + near-term purchase).

**Out of scope for current design** — Phase 4b produces a single equity/buffer split per goal, and the clarify stage is already scoped to one goal at a time. Parked as reference for a future multi-goal pivot.

## Alignment against the pass-1 spec (post-web-verified)

| Literature norm | `PHASE_4B_PLAN.md` hypothesis | Assessment |
|---|---|---|
| Willingness × capacity | 5-factor anchor (risk + timeline + age + EF + debt) | **Overcounts** — age redundant, EF/debt are gates |
| Discrete anchors keyed on willingness × timeline | Factor table implied | **Aligned, but should be 2-dimensional** |
| ~7–9 practitioner anchors | 3-bucket willingness × N timelines | **Coarser than industry**, defensible as behavioral simplification |
| Long-horizon anchor ranges | Draft 40–90% equity | **Aligned with practitioner norms** |
| Short-horizon anchor ranges | Pass-1 draft 20–60% equity | **Wrong** — <3yr is cash-dominated for all tolerances |
| EF/debt as suitability gates | Treated as factor inputs | **Mismatch** — move to conversational qualifiers |
| Pre-stated split early-exit | Brief confirm, accept | **Needs sanity-check carve-out** for extreme mismatches |
| "Sizing reduces panic-selling" | Primary behavioral safeguard | **Directionally correct**, wording should be "tends to reduce" |

## Decision

**Decision date:** 2026-04-21
**Status:** Adopted pending user review. Supersedes the `PHASE_4B_PLAN.md` factor-table hypothesis. Implementation (Step 2) unblocks after user approval.

### What we switched from

Pass-1 spec: five-factor anchor combining risk tolerance + timeline + age + emergency fund + debt, via a factor table with illustrative ranges in the 20–90% equity band across all timelines.

### What we switched to

**Two-axis anchor: risk tolerance × timeline.**

| Willingness \ Timeline | < 3 yr | 3–5 yr | 5–10 yr | 10+ yr |
|---|---|---|---|---|
| Conservative | 0–10% | 10–20% | 30–40% | 40–50% |
| Moderate | 0–10% | 20–30% | 50–60% | 60–70% |
| Aggressive | 0–10% | 30–40% | 60–70% | 80–90% |

Key changes from the original spec:

- **Age dropped.** Redundant with timeline — TDF glidepaths use years-to-retirement, not age. No primary source treats age as an independent continuous input alongside timeline.
- **Emergency fund and debt become conversational suitability qualifiers**, not anchor inputs. If the user lacks an EF or carries high-interest debt, the agent surfaces the concern and asks how they want to proceed, but does not shift the anchor percentage. Industry norm is to treat these as pre-investment gates.
- **Short-horizon (<3yr) collapses** across all willingness levels at 0–10% equity. Capacity constraints dominate — risk tolerance is not a meaningful dial at that horizon per Vanguard, Fidelity, Bogleheads.
- **Pre-stated-split early-exit with sanity-check carve-out.** Default: accept the user's stated split with brief confirm. Exception: if the stated split is extreme relative to capacity (100% equity with <3yr horizon, or 0% equity with 20+yr horizon and aggressive risk), surface the mismatch in one turn, then accept the user's final answer.
- **Behavioral framing:** "sizing to tolerance tends to reduce panic-selling" — not "prevents". Aligned with Kitces's composure-vs-tolerance distinction.

### Why this is better

1. **Research-aligned.** Vanguard, Fidelity, BlackRock, Bogleheads, FinaMetrica, and TDF glidepath literature all converge on willingness × timeline as the two primary sizing factors. Age is a proxy for timeline; EF and debt are gates. Our design now matches.
2. **Simpler to prompt, eval, and reason about.** A 3×4 table is trivially representable; a 5-factor interaction is not. Eval cases map 1:1 to cells.
3. **Defensible against "inventing a method".** Each anchor in the table traces to practitioner norms.
4. **Honest about capacity constraints.** Short-horizon collapse and EF/debt qualifiers acknowledge capacity bounds that cannot be overridden by high willingness alone.

### What we considered and rejected

- **Five-factor anchor (original spec).** Age redundant with timeline; EF/debt not treated as continuous inputs anywhere in the literature. Overengineered relative to what literature supports.
- **Continuous formula for equity%.** More precision but invites false-precision critiques; harder to prompt/eval. Rejected in favor of discrete cells.
- **Finer-grained table matching Vanguard's 9 anchors or Fidelity's 7.** Would require a richer willingness input than Phase 4's 3-bucket output. Deferred — if evals show the 3×4 table flattens genuinely different users, we can refine later using Phase 4's `selfRatingScore` field without changing the instrument.
- **Hard block on pre-stated splits that fail sanity check.** Inconsistent with "user has final say" philosophy. Sanity check surfaces, does not block.
- **Composure probe.** No primary-source evidence that a short-form composure probe works for beginners. Not worth inventing a method.

### Honest trade-offs

1. **3-bucket willingness input.** Phase 4 outputs 3 buckets; our anchor table is correspondingly coarse. Industry norm is 7–9 anchors. A user at `selfRatingScore=5` and one at `selfRatingScore=4` both map to `aggressive` with the same anchor. If evals surface discrimination problems, the `selfRatingScore` field in `RiskPhaseOutput` is available to refine without changing Phase 4.
2. **Point-estimate, not distribution.** Single integer (e.g., 70%), not a range. Acceptable for a behavioral anchor; not acceptable as portfolio-optimization output.
3. **No composure probe.** Phase 4's 1–5 measures tolerance, not composure. A well-sized user may still panic-sell if perception of the drawdown changes. Rules file frames sizing as reducing — not preventing — panic-selling.
4. **No household balance sheet.** We have `fields.amount`, `age`, `timeline`, `hasEmergencyFund`, `hasDebt`. We don't have income, other assets, liquidity needs beyond EF, or spouse's situation. Anchor is sized against this portfolio only.
5. **Short-horizon collapse may surprise users** who expect their risk tolerance to matter at 2-year horizons. Rules file explains the capacity-dominates framing when this happens.
6. **Anchor ranges are cells, not points.** The prompt instructs the model to pick within the range based on the specific user (e.g., `Moderate / 10+ yr` is 60–70%; an inside-the-cell choice is a model judgment call). This adds a small amount of model-dependent variance.

### Open caveats to document in the rules file

- Anchor is a point-estimate, not a range or distribution.
- "Sizing tends to reduce panic-selling" — directional, not absolute.
- EF and debt are surfaced as conversational suitability qualifiers; they do not shift the anchor percentage.
- Pre-stated-split is accepted by default; sanity-check fires only when the stated split is extreme relative to capacity.
- Short-horizon (<3yr) collapses all willingness levels to 0–10% equity. User can override — if they push back, the agent accepts with honest framing ("we'd usually keep money you need in 3 years in cash, but if you're comfortable with the drawdown risk, here's what that looks like").

### Implications for `PHASE_4B_PLAN.md` and `CLARIFY_REFACTOR_PLAN.md`

Before writing code, update both docs to reflect the adopted design:

- **`PHASE_4B_PLAN.md`**: replace the 5-factor anchor hypothesis with the 2-axis table; remove age/EF/debt from the factor table; add the sanity-check-on-extreme-mismatch rule to the pre-stated-split section; update the rules file outline and eval outline to match.
- **`CLARIFY_REFACTOR_PLAN.md`**: no schema changes needed (`AllocationPhaseOutput` is still `{ equityPercentage, bufferPercentage }`). Context string format doesn't change — we still pass `hasEmergencyFund` and `hasDebt` even though they're qualifiers not anchor inputs, because the prompt needs them for the conversational sanity check.

## Sources (web-verified pass)

- [Kitces — Separating Risk Tolerance From Risk Capacity](https://www.kitces.com/blog/separating-risk-tolerance-from-risk-capacity-just-because-you-can-afford-to-take-risk-doesnt-mean-you-should/)
- [Kitces — The Two-Dimensional Risk Tolerance Assessment Process](https://www.kitces.com/blog/tolerisk-aligning-risk-tolerance-and-risk-capacity-on-two-dimensions/)
- [Kitces — When Investors "Need" More Risk Than They Can Tolerate](https://www.kitces.com/blog/goal-risk-tolerance-mismatch-need-capacity-accommodative-authoritative-portfolio-design/)
- [Kitces — The Sorry State Of Risk Tolerance Questionnaires](https://www.kitces.com/blog/risk-tolerance-questionnaire-and-risk-profiling-problems-for-financial-advisors-planplus-study/)
- [Kitces — Risk Composure And The Stability Of Investor Risk Perception](https://www.kitces.com/blog/risk-composure-stability-risk-perception-predicting-investor-behavior-biases/)
- [Kitces — Does The DALBAR Study Grossly Overstate The Behavior Gap?](https://www.kitces.com/blog/does-the-dalbar-study-grossly-overstate-the-behavior-gap-guest-post/)
- [Morningstar — Pinning Down Portfolio Rules of Thumb](https://www.morningstar.com/markets/pinning-down-portfolio-rules-thumb)
- [Vanguard LifeStrategy Funds](https://investor.vanguard.com/investment-products/mutual-funds/life-strategy-funds)
- [Vanguard Investor Questionnaire](https://investor.vanguard.com/tools-calculators/investor-questionnaire)
- [Vanguard — Short-term Savings Goals](https://investor.vanguard.com/investor-resources-education/short-term-savings-goals)
- [Vanguard — Choose the Right Asset Mix](https://ownyourfuture.vanguard.com/content/en/learn/financial-planning/choose-the-right-asset-mix-for-your-financial-situation.html)
- [Vanguard — Emergency Fund Guide](https://investor.vanguard.com/investor-resources-education/emergency-fund)
- [Vanguard — TDF Glide Path](https://workplace.vanguard.com/investment/strategies/tdf-glide-path.html)
- [Vanguard — TDF Glide Path Essentials](https://workplace.vanguard.com/insights-and-research/perspective/tdf-glide-path-essentials-setting-the-right-starting-point.html)
- [Fidelity Asset Manager Funds](https://www.fidelity.com/mutual-funds/fidelity-fund-portfolios/asset-manager-funds)
- [Fidelity — Investing for Short-Term Goals](https://www.fidelity.com/learning-center/trading-investing/investing-for-short-term-goals)
- [Fidelity — Freedom Funds (target-date)](https://www.fidelity.com/mutual-funds/fidelity-fund-portfolios/freedom-funds)
- [BlackRock iShares — AOA product page](https://www.ishares.com/us/products/239729/ishares-aggressive-allocation-etf)
- [BlackRock iShares Core Allocation product brief PDF](https://www.ishares.com/us/literature/product-brief/ishares-core-esg-allocation-brief.pdf)
- [FinaMetrica — How it Works](https://riskprofiling.com/How-it-Works)
- [Morningstar / FinaMetrica documentation](https://help.adviserlogic.com/en/articles/10584886-morningstar-risk-profiling-powered-by-finametrica)
- [FPA Journal — Risk Tolerance Questions to Best Determine Client Portfolio Allocation Preferences](https://www.financialplanningassociation.org/article/journal/MAY12-risk-tolerance-questions-best-determine-client-portfolio-allocation-preferences)
- [Grable-Lytton 13-Item Risk Tolerance Scale](https://www.kitces.com/wp-content/uploads/2019/11/Grable-Lytton-Risk-Assessment.pdf)
- [DALBAR — QAIB overview](https://www.dalbar.com/qaib/)
- [DALBAR — 2024 QAIB Press Release](https://www.dalbar.com/PressReleases/doc/QAIB2024_PR.pdf)
- [FINRA Rule 2111 — Suitability](https://www.finra.org/rules-guidance/rulebooks/finra-rules/2111)
- [FINRA Rule 2111 FAQ](https://www.finra.org/rules-guidance/key-topics/suitability/faq)
- [CFP Board — Code of Ethics and Standards of Conduct](https://www.cfp.net/ethics/code-of-ethics-and-standards-of-conduct)
- [CFP Board — Fiduciary Duty When Providing Financial Advice](https://www.cfp.net/ethics/compliance-resources/2018/05/focus-on-ethics---cfp-professionals-fiduciary-duty-when-providing-financial-advice)
- [ESMA — MiFID II Suitability Guidelines Final Report PDF](https://www.esma.europa.eu/sites/default/files/2023-04/ESMA35-43-3172_Guidelines_on_certain_aspects_of_the_MiFID_II_suitability_requirements.pdf)
- [Bogleheads — Prioritizing Investments](https://www.bogleheads.org/wiki/Prioritizing_investments)
- [Bogleheads — Emergency Fund](https://www.bogleheads.org/wiki/Emergency_fund)
- [Bogleheads — Three-fund portfolio](https://www.bogleheads.org/wiki/Three-fund_portfolio)
- [Bogleheads — Glide paths](https://www.bogleheads.org/wiki/Glide_paths)
- [J.P. Morgan — Decoding Target Date Fund Design](https://am.jpmorgan.com/us/en/asset-management/adv/insights/retirement-insights/decoding-target-date-fund-design/)
- [Shefrin & Statman — Behavioral Portfolio Theory (PDF)](http://efinance.org.cn/cn/fm/Behavioral%20Portfolio%20Theory.pdf)
