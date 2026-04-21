# Risk Phase — Research Notes

**Date:** 2026-04-21 (web-verified pass + design decision)
**Status:** Reference document. Records the research and the design decision that came out of it.

## Caveat on sources

This doc went through two research passes:

1. An initial synthesis from training-memory knowledge (directionally reliable, specific numbers approximate).
2. A web-verified pass using real primary and industry sources, listed at the end of this doc.

The web-verified pass confirmed most of the training-memory findings, nuanced one, and surfaced a new finding that changed the design. Load-bearing claims below are tagged **[verified]** if the web pass found direct support, **[partial]** if support was suggestive but not definitive, and **[unverified]** where no direct source was located.

## Why this doc exists

Phase 4 (risk) was originally designed as a two-turn A/B drop scenario producing three buckets (conservative / moderate / aggressive). After the two-turn flow landed, the design's shape felt off without a clear articulation of why. This doc captures what the risk-tolerance assessment literature says is considered good practice, rates our prior design against it, and records the decision to switch from A/B scenarios to a single-question 1-5 self-rating.

## Findings

### 1. Separate "willingness" from "ability" — **[verified]**

The field distinguishes two things that beginners (and bad instruments) conflate:

- **Willingness** (risk tolerance) — psychological/behavioral comfort with loss. Stable trait.
- **Ability** (risk capacity) — objective situation: timeline, age, emergency fund, debt.

Every serious framework — Grable-Lytton, FinaMetrica, MiFID II, CFP Board — treats these as separate dimensions. The CFA Institute 2017 *Psychometric Review* and their 2010 *Investment Risk Profiling* guide both affirm this. Our design preserves the separation: Phase 4 measures willingness only; Phase 4b combines willingness with capacity to produce the allocation.

### 2. Single-scenario A/B is weak — and direct self-rating beats it — **[verified, with new finding]**

The canonical instruments avoid single-scenario binaries:

- **Grable-Lytton (GL-13):** 13 items, mixed format.
- **FinaMetrica:** 25 items, heavily psychometric, validated across 1.7M tests in 35 countries.
- **MiFID II:** typically 10–30 items by regulation.

**New finding from the web-verified pass:** Statman's published questionnaire research, the FPA journal, the Kitces analyses, and the CFA Institute psychometric review all converge on the same point — **direct self-rating items outperform hypothetical gambling scenarios.** The single question with the highest predictive power is some variant of "What degree of risk have you assumed on your investments in the past?" — or, where no past exists, a direct self-rating of comfort with loss.

This is the finding that changed the design (see "Decision" section below).

### 3. Framing effects on risk-tolerance questionnaires are specifically documented — **[verified]**

The 1990 paper *"Effects of 'Framing' on measures of risk tolerance: Financial planners are not immune"* (ScienceDirect) shows even professional advisors are biased by framing. Prospect theory applies specifically to this class of question. Our prior Turn 1 reassurance ("markets have recovered from 2008 and 2020") is a gain-frame that biases responses directionally.

Mitigations used in professional tools: neutral or loss-framed wording, concrete currency over percentages, and treating self-reported tolerance as an upper bound with conservatism applied downstream.

### 4. Three buckets is coarser than practitioner norm — **[verified]**

Most robo-advisors use 5–10 risk levels. Three buckets is defensible **only** when the downstream sizing step absorbs the imprecision — which is how FinaMetrica treats self-reported tolerance (upper bound fed to a conservative sizing rule).

### 5. Hypothetical-real gap is real, but narrower than older sources implied — **[verified, nuanced]**

Dalbar QAIB has measured the gap between investor returns and market returns since 1994. **The 2025 gap narrowed to 0.72%** (S&P 500: 17.88% vs. Average Equity Investor: 17.16%) — the third-smallest since 1985 and the smallest since 2012. Historical gaps were materially larger. The "people say they'd hold and then panic-sell" narrative is still directionally true, but the effect size in recent years is smaller than older framing implied. Doesn't invalidate the concern — tempers how dramatic we should make it.

### 6. Pension-allocation-choice as a risk-tolerance proxy — **[unverified]**

Considered during design discussion as a past-behavior proxy for Israeli beginners. The web-verified pass found no direct research validating pension-track choice as a predictor of broader investment risk tolerance. Tangential work on 401(k) allocation exists but does not establish the proxy. Absence of evidence is itself informative — we were inventing a method rather than applying one. This option was rejected; see "Decision" below.

## Alignment against the old two-turn A/B design

| Literature norm | Old design | Assessment |
|---|---|---|
| Separate willingness from ability | Goal/age/timeline grounding only; classifier behavioral | **Aligned** |
| Use a richer probe than a single hypothetical | One A/B question, conditionally two | **Weakest axis** |
| Avoid directional priming language | Turn 1 included "markets have recovered" framing | **Knowingly biased** |
| Output granularity 5–10 buckets typical | 3 buckets | **Defensible only if Phase 4b absorbs imprecision** |
| Use past-behavior probes where available | Not asked | **Missing** |

## The tension the old design created

The old design's defensibility rested on "Phase 4b (allocation sizing) absorbs upstream weakness." That premise was conditionally true:

- It held for *random* error (one-bucket-high offset by one-bucket-low).
- It did **not** hold for *systematic* bias. Historical-recovery framing shifts answers directionally. Phase 4b sizes against the bucket it receives — if priming consistently pushed users toward `aggressive`, 4b sized them at the aggressive anchor (80–100% equity), not at the bucket they actually belonged in.

Sizing absorbs imprecision. It does not absorb bias. This is the tension the new design resolves at the source.

## Decision — switching from A/B scenarios to 1-5 self-rating

**Decision date:** 2026-04-21
**Status:** Adopted. Supersedes the two-turn A/B design. Implementation pending.

### What we switched from

Two-turn A/B drop scenario: *"Would you sell (A) or stay invested (B) if the market dropped 20%? [If B] What about 35%?"* with historical-recovery framing in Turn 1, educational fallback on uncertain answers, and market-timing redirect. Output: 3 buckets. Prompt-based state machine exhibited an intermittent adherence flake (~1 in 3–4 runs, model short-circuiting a mandatory step).

### What we switched to

A single-question self-rating:

> "Before we design your allocation, I need to understand your comfort with market ups and downs. On a scale of 1 to 5, how would you describe your comfort with seeing your investments drop temporarily?
>
> 1 = very uncomfortable — I'd want to sell immediately
> 3 = neutral — I'd be uneasy but try to hold
> 5 = completely comfortable — I'd see it as a buying opportunity"

Deterministic mapping:
- 1–2 → `conservative`
- 3 → `moderate`
- 4–5 → `aggressive`

Output type:
```ts
type RiskPhaseOutput = {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  selfRatingScore: 1 | 2 | 3 | 4 | 5;  // preserved for Phase 4b calibration if needed
};
```

### Why this is better

1. **Research-aligned.** Self-rating has higher predictive validity than hypothetical scenarios per Statman, Kitces, and the CFA Institute psychometric review. A/B scenarios were explicitly the weakest format in the literature.
2. **Preserves willingness/capacity separation.** Fields (age, timeline, emergency fund, debt) stay in Phase 4b where they belong. Phase 4 is purely willingness.
3. **Eliminates the known bias vectors.** No historical framing, no scenario priming. Self-rating is less susceptible to framing than hypothetical scenarios.
4. **Structurally simpler.** Single question, deterministic mapping, no post-loop extraction, no state machine. The adherence flake disappears because there is no multi-step flow to fail at.
5. **Removes the "Phase 4b absorbs bias" premise.** With less-biased willingness input, Phase 4b's job becomes what it should be — combining willingness with capacity, not cleaning up priming.

### What we considered and rejected

**Pension-past-behavior probe.** For Israeli users, asking about pension track choice and observed drawdown behavior as a past-behavior proxy. The idea was principled (past behavior is the highest-validity signal per the literature) but:

- No research directly validates pension-allocation-choice as a risk-tolerance proxy. We would have been inventing a method, not applying one.
- It added significant complexity (LLM classifier for track/behavior, multiple branches, richer output schema, more evals) for plausible-but-unvalidated benefit.
- It would have required the code-based state-machine refactor as a prerequisite.
- It would have obligated Phase 4b to interpret a graded `derivedFrom` signal, adding cross-phase coupling.

Parked as reference for future work if a real need emerges. Not being pursued as part of the current refactor.

### Honest trade-offs

1. **Self-rating is still self-report, not past behavior.** The gold standard (past-behavior probes) is unavailable to true beginners. We are accepting a principled upper-bound of "as good as self-report gets."
2. **We lose the visceral reflection that scenarios produce.** Some users benefit pedagogically from being forced to think "what would a 20% drop feel like?" The research says this reflection doesn't improve predictive validity — but it's an educational loss worth naming.
3. **Anchor wording matters a lot.** A 1–5 scale is only as good as its anchor definitions. "3 = neutral" means different things to different people. Mitigation: concrete behavioral anchors at 1/3/5, not abstract adjectives.
4. **The 3-bucket floor can flatten genuinely different users.** A user at 5 and a user at 4 both map to `aggressive`. If evals surface misclassification, the mapping can be tightened without changing the instrument.

### Open caveats to document in the rules file

- Self-rating is a principled choice with known limits. If we ever want to strengthen the signal, the research path is a multi-item psychometric (FinaMetrica-style), not a return to scenario-based probes.
- Framing of the scale must be neutral — no "most beginners pick 3" suggestions, no language priming a socially-desired answer.
- The `selfRatingScore` field is preserved in the output in case Phase 4b ever wants to calibrate on it (e.g., differentiate a "5" aggressive user from a "4" aggressive user).

## Sources (web-verified pass)

- [Predicting Financial Risk Tolerance and Risk-Taking Behaviour: A Comparison of Questionnaires and Tests (ResearchGate)](https://www.researchgate.net/publication/379098288_Predicting_Financial_Risk_Tolerance_and_Risk-Taking_Behaviour_A_Comparison_of_Questionnaires_and_Tests)
- [Financial Risk Tolerance: A Psychometric Review (CFA Institute)](https://rpc.cfainstitute.org/research/foundation/2017/financial-risk-tolerance)
- [Risk Tolerance Questions to Best Determine Client Portfolio Allocation Preferences (FPA)](https://www.financialplanningassociation.org/article/journal/MAY12-risk-tolerance-questions-best-determine-client-portfolio-allocation-preferences)
- [5 Questions Using Risk Assessment Data To Uncover Clients' True Concerns (Kitces)](https://www.kitces.com/blog/5-questions-risk-assessment-tolerance-financial-planning-market-volatility/)
- [The Sorry State Of Risk Tolerance Questionnaires (Kitces)](https://www.kitces.com/blog/risk-tolerance-questionnaire-and-risk-profiling-problems-for-financial-advisors-planplus-study/)
- [Questionnaires of Risk Tolerance, Regret, Overconfidence, and Other Investor Propensities (Statman)](https://www.scu.edu/media/leavey-school-of-business/finance-/statman-files/Questionnaire-JIC.pdf)
- [Effects of "Framing" on measures of risk tolerance (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/0090572090900297)
- [DALBAR 2026 QAIB — narrower investor gap in 2025 (PRNewswire)](https://www.prnewswire.com/news-releases/dalbars-2026-qaib-report-shows-narrower-investor-gap-amid-a-complex-and-volatile-market-year-302745998.html)
- [Investment Risk Profiling: A Guide for Financial Advisors (CFA Institute)](https://rpc.cfainstitute.org/sites/default/files/-/media/documents/survey/investment-risk-profiling.pdf)
- [Israeli pension funds shift toward S&P 500 (CTech)](https://www.calcalistech.com/ctechnews/article/rjjq3s7g1g) — pension-proxy context; not used in final design
- [Pensions in Israel (Wikipedia)](https://en.wikipedia.org/wiki/Pensions_in_Israel) — pension-proxy context; not used in final design
