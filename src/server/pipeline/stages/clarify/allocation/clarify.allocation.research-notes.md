# Allocation Phase — Research Notes

**Date:** 2026-04-21
**Status:** Reference. Records the design decision and the research behind it.

> **Update (2026-06-13):** The risk phase no longer emits a tolerance bucket — allocation now derives it from `riskSelfRatingScore` via `mapRiskSelfRatingScoreToTolerance`. References below to a "3-bucket output from Phase 4" describe the same buckets, now computed inside this phase. The two-axis design is unchanged. See `clarify.allocation.rules.md` for current behavior.

## Decision

Phase 4b uses a **two-axis anchor table: risk tolerance × timeline**.

| Willingness \ Timeline | 3–5 yr | 5–10 yr | 10+ yr |
| ---------------------- | ------ | ------- | ------ |
| Conservative           | 10–20% | 30–40%  | 40–50% |
| Moderate               | 20–30% | 50–60%  | 60–70% |
| Aggressive             | 30–40% | 60–70%  | 80–90% |

Key rules:

- **Short-horizon exit:** Users with <3yr timeline never reach this phase. The orchestrator exits after parameters collection and redirects them to a money market fund — risk tolerance is not a meaningful dial below ~3 years, and proposing an ETF allocation for money needed soon would be a disservice.
- **EF and debt are suitability gates, not anchor inputs.** If the user lacks an EF or carries high-interest debt, the agent surfaces the concern and asks how they want to proceed — the anchor percentage does not shift.
- **Pre-stated split:** accept by default. Exception: if the split is extreme relative to capacity (e.g., 100% equity with <3yr horizon, or 0% equity with 20+yr horizon + aggressive risk), surface the mismatch in one turn, then accept the user's final answer.
- **Behavioral framing:** "sizing to tolerance _tends to_ reduce panic-selling" — not "prevents".

Replaces a five-factor anchor (risk + timeline + age + EF + debt) from the original `PHASE_4B_PLAN.md`.

## Key Findings

**1. Willingness × capacity is the professional norm — [partial]**
Kitces explicitly advocates separating risk tolerance from risk capacity and combining them separately. Single-variable age rules are consumer shorthand, not professional methodology.

**2. Industry uses 7–9 discrete anchors, not 3 — [verified]**
Vanguard LifeStrategy (4 funds), iShares Core Allocation ETFs (4), Fidelity Asset Manager (7-fund ladder), Vanguard questionnaire (9 portfolios). Our 3-bucket table is a conscious behavioral simplification relative to industry practice.

**3. "Sizing reduces panic-selling" is directional, not causal — [verified]**
Dalbar QAIB is correlational, not a controlled study. Kitces argues panic-selling stems from _risk composure_ instability (risk perception changing during drawdowns), not miscalibrated tolerance — even the mechanism is contested.

**4. Timeline dominates; age is a proxy; EF/debt are gates — [verified] (LOAD-BEARING)**

- TDF glidepaths are functions of years-to-retirement, not age. Age is just a proxy for timeline.
- EF is treated by Vanguard and Bogleheads as a prerequisite before investing, not a continuous allocation input.
- High-interest debt is treated by Bogleheads as a top-priority payoff before taxable investing.
- No primary source treats EF or debt as continuous anchor inputs to the equity/bond split.

**5. Short-horizon anchors are much tighter than intuition suggests — [verified, corrected from pass 1]**

- <1yr: 0% equity — cash, MMF, high-yield savings.
- 1–3yr: dominated by short-term bonds/CDs; at most a token equity slice.
- 3–5yr: 20–40% equity, graded by tolerance.
- Pass-1 draft had short-horizon at 20–60% equity — **this was wrong**. Risk tolerance is not a meaningful dial below ~3 years. Implemented as an orchestrator-level early exit: <3yr users are redirected to a money market fund before reaching this phase.

**6. Pre-stated-split sanity check aligns with fiduciary norms — [verified]**
FINRA 2111, CFP Board, and MiFID II all require pushing back on client-directed splits that conflict with the client's profile. We're not a regulated fiduciary, but a lightweight sanity check is consistent with "user has final say, trade-offs presented honestly".

**7. Risk composure ≠ risk tolerance — [verified]**
Kitces distinguishes composure (stability of risk perception over time) from tolerance (static preference). Phase 4's 1–5 measures tolerance, not composure. We have no composure probe and won't invent one without evidence.

## Why 2-Axis Replaced the 5-Factor Design

| Issue with 5-factor spec                    | How 2-axis resolves it                                            |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Age redundant with timeline                 | Dropped — TDF glidepaths use years-to-retirement, not age         |
| EF/debt treated as continuous anchor inputs | Moved to conversational suitability qualifiers                    |
| Short-horizon at 20–60% equity              | Orchestrator exits early for <3yr; phase never sees this timeline |
| 5-factor interaction hard to prompt/eval    | 3×4 table maps 1:1 to eval cases                                  |

## Trade-offs

1. **3-bucket willingness input.** Industry norm is 7–9 anchors. A `riskSelfRatingScore=5` and a `riskSelfRatingScore=4` both map to `aggressive` with the same anchor. `riskSelfRatingScore` is available to refine without changing Phase 4 if evals show discrimination problems.
2. **Point-estimate, not distribution.** Single integer (e.g., 70%), not a range. Acceptable for a behavioral anchor; not appropriate as portfolio-optimization output.
3. **No composure probe.** A well-sized user may still panic-sell if risk perception changes during a drawdown. Rules file frames sizing as reducing — not preventing — panic-selling.
4. **No household balance sheet.** We have `amount`, `age`, `timeline`, `hasEmergencyFund`, `hasDebt`. No income, other assets, liquidity needs beyond EF, or spouse's situation.
5. **Short-horizon collapse may surprise users.** If a user pushes back, the agent accepts with honest framing — the concern is stated, not enforced.
6. **Cell ranges, not points.** The prompt instructs the model to pick within the range based on the specific user, which adds a small amount of model-dependent variance.

## Rejected Alternatives

- **Five-factor anchor.** Age redundant with timeline; EF/debt not treated as continuous inputs anywhere in the literature.
- **Continuous formula for equity%.** Harder to prompt and eval; invites false-precision critiques.
- **Finer-grained table (7–9 anchors).** Requires richer willingness input than Phase 4's 3-bucket output. Deferred — can be refined using `riskSelfRatingScore` if evals show the need.
- **Hard block on pre-stated splits.** Inconsistent with "user has final say" philosophy.
- **Composure probe.** No primary-source evidence that a short-form composure probe works for beginners.
