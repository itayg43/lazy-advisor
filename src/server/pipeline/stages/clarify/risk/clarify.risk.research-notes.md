# Risk Phase — Research Notes

**Date:** 2026-04-21
**Status:** Reference. Records the design decision and the research behind it.

## Decision

Phase 4 uses a **single 1–5 self-rating** to measure risk willingness. Deterministic mapping:

- 1–2 → `conservative`
- 3 → `moderate`
- 4–5 → `aggressive`

```ts
type RiskPhaseOutput = {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  selfRatingScore: 1 | 2 | 3 | 4 | 5; // preserved for Phase 4b calibration
};
```

Replaces a two-turn A/B drop scenario (the prior design).

## Key Findings

**1. Willingness ≠ ability — [verified]**
The field separates *risk tolerance* (psychological comfort with loss; stable trait) from *risk capacity* (objective situation: timeline, age, EF, debt). Every serious framework — Grable-Lytton, FinaMetrica, MiFID II, CFP Board — treats these as separate dimensions. Phase 4 measures willingness only; Phase 4b combines willingness with capacity.

**2. Self-rating outperforms hypothetical scenarios — [verified]**
Statman, Kitces, and the CFA Institute psychometric review all find direct self-rating items have higher predictive validity than single-scenario A/B probes. The highest-predictive-power question is a direct comfort-with-loss self-rating, not a hypothetical gambling scenario.

**3. Framing effects on risk-tolerance questions are specifically documented — [verified]**
Prospect theory applies directly to this class of question. The prior Turn 1 reassurance ("markets have recovered from 2008/2020") was a gain-frame that biased responses toward `aggressive`. Self-rating is less susceptible to framing than hypothetical scenarios.

**4. Three buckets is coarser than practitioner norm — [verified]**
Professional tools use 5–10 risk levels. Three is defensible only if Phase 4b absorbs the imprecision — which is how FinaMetrica treats self-reported tolerance (upper bound fed to a conservative sizing rule). That's our design.

**5. Hypothetical-real behavioral gap has narrowed — [verified, nuanced]**
The 2025 Dalbar QAIB gap was 0.72% (vs. materially larger historical gaps). "People say they'd hold but then panic-sell" is directionally true but less dramatic than older framing implied. Doesn't invalidate the concern — tempers how strongly we should frame it.

## Why Self-Rating Replaced the A/B Scenario Design

| Weakness of A/B design | How self-rating resolves it |
|---|---|
| Gain-frame priming ("markets recovered") biased answers directionally | No historical framing in self-rating |
| Single hypothetical: weakest format per literature | Direct comfort rating: highest predictive validity |
| Multi-step state machine had ~1-in-3 adherence flake | Single question, no state machine, no post-loop extraction |
| Phase 4b had to absorb bias, not just imprecision | Phase 4b now absorbs imprecision only |

## Trade-offs

1. **Still self-report, not past behavior.** Gold standard is behavioral observation; unavailable for true beginners. We're accepting the best available self-report format.
2. **No visceral scenario reflection.** Some users benefit pedagogically from "what would a 20% drop feel like?" The research says it doesn't improve predictive validity — but it's an educational loss worth naming.
3. **3-bucket floor flattens users.** A user at 5 and a user at 4 both map to `aggressive` with the same anchor. If evals surface discrimination problems, `selfRatingScore` is available to refine the mapping without changing Phase 4.
4. **Anchor wording matters.** A 1–5 scale is only as good as its behavioral anchors. No priming language ("most beginners pick 3"), no social-desirability cues.

## Rejected: Pension Past-Behavior Probe

For Israeli users, asking about pension track choice as a past-behavior proxy was considered (past behavior is the highest-validity signal per the literature). Rejected because:
- No research directly validates pension-allocation-choice as a risk-tolerance proxy — we'd be inventing a method, not applying one.
- Added significant complexity (LLM classifier, multiple branches, richer output schema, more evals) for plausible-but-unvalidated benefit.
- Required cross-phase coupling (Phase 4b would need to interpret a graded `derivedFrom` signal).

Parked as future reference if a real need emerges.

