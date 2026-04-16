# Clarify Stage — Implementation Spec

All decisions are finalized. This document is the source of truth for implementing the clarify stage redesign.

---

## Implementation Order

1. Structured phase passing (foundation)
2. Risk phase (built into the new structure)
3. Fields, preferences, extraction updated to new contracts
4. Intake phase prompt improvements and eval expansions
5. Constants file (`clarify.constants.ts`) — benchmark figures + risk scenario builder

---

## 1. Architecture: Structured Phase Passing

Replace full-transcript passing between phases with typed I/O contracts. Remove `buildSourceParams` and cross-phase `previous_response_id` chaining.

**Phase contracts:**

```
fields phase    → receives { goalText }, returns FieldsOutput
                  { amount, age, timeline, knowledgeLevel, hasEmergencyFund, hasDebt, monthlyContribution, goalText }
risk phase      → receives { amount }, returns RiskOutput
                  { riskTolerance }
preferences     → receives { riskTolerance, amount, timeline }, returns PrefsOutput
                  { investmentPreferences }
extraction      → receives all structured outputs, assembles UserProfile
                  (thin LLM call for goal summary only — no profile re-derivation)
```

**Post-loop extraction (all phases):** The Q&A loop owns the conversation. When the loop exits (model stopped asking), a separate structured extraction call (`zodTextFormat`) pulls the phase's output from its own conversation. Loop = Q&A, extraction = structure.

**Phase-completion convention:** All phases are silent on completion. No terminal text message from any phase. The orchestrator owns transition messages between phases.

**Intake changes:**
- `contradictory` intake phase dropped — risk contradiction resolved naturally by the risk phase
- `out_of_scope` and `unrealistic` intake phases kept

**Brokerage field dropped** from the profile entirely.

**Per-phase rule files:** One rule file per phase (e.g., `clarify.fields.rules.md`, `clarify.risk.rules.md`) replaces the current monolithic rules file. Stage-level rules cover phase list, data contracts, and orchestration only.

**Evals:** Each phase eval passes structured inputs (not a full transcript) and tests Q&A behavior and post-loop extraction independently.

---

## 2. New Risk Phase

A dedicated phase inserted between fields and preferences. Single responsibility: resolve `riskTolerance`.

**Scenario builder:** `buildRiskScenario(amount: number)` added to `clarify.constants.ts`. Contains:
- Personalized scenario wording (injects the user's actual ₪ amount and the 20%-drop figure)
- B follow-up question text
- Internal mapping rules: A → conservative, B + stressed → moderate, B + calm → aggressive

Taxonomy labels (conservative/moderate/aggressive) are internal only — never shown to the user.

**Two-step resolution flow:**

Turn 1 — present A/B scenario using `buildRiskScenario(amount)`:
- A: sell → `conservative`, phase exits
- B: hold → proceed to follow-up

Follow-up — "Would you find that stressful to watch, or stay pretty calm?":
- Stressed → `moderate`, phase exits
- Calm → `aggressive`, phase exits

**Educational fallbacks (re-ask after explanation, do not exit):**

- "I don't know" → explain that drops are normal, long-term holders historically recovered, selling locks in the loss and requires correct re-entry timing → re-ask A/B
- Market-timing answer (e.g., "sell to buy back lower") → explain why timing is hard even for professionals (missing best recovery days) → redirect to A/B; do NOT validate as a strategy

**Persistence:** Phase loops until a real behavioral signal is obtained. If no clear signal after 3 turns, default to `conservative`.

**No fallback / no secondary signals in the prompt.** Secondary signal logic is removed from extraction entirely — `riskTolerance` is resolved before extraction.

**Output passing:** `riskTolerance` passed as a parameter to the preferences phase so it can adjust framing (e.g., flag NASDAQ volatility more prominently for conservative users). Extraction copies the value; it does not re-derive it.

---

## 3. Fields Phase: `monthlyContribution`

The deflect-twice rule ("accept the best available answer and move on") does not apply to `monthlyContribution` — there is no numeric floor to accept from a vague answer.

**Changes:**
1. On the second ask, append: "If you're not planning to add to this investment each month, ₪0 is a valid answer."
2. After two asks with no specific value, default to `monthlyContribution: 0`
3. `₪0` is a valid value throughout — extraction, risk phase DCA assumption, and preferences projections must handle `monthlyContribution: 0` (no DCA, lump-sum-only framing)

**Eval additions:**
- User says "whatever I can" on first ask, "I'm not sure, maybe a small amount" on second → extracted `monthlyContribution: 0`
- User explicitly says ₪0 on first ask → extracted `monthlyContribution: 0` without a second probe

---

## 4. Constants: Benchmark Figures

All benchmark return figures move to `clarify.constants.ts`. Prompts and evals import from there — no hardcoded figures elsewhere.

**Shape:**

```ts
export const BENCHMARK_RETURNS = {
  ftseAllWorld:  { longTerm: "~8–10%/yr",      recentDecade: "~10%/yr"      },
  msciWorld:     { longTerm: "~9–11%/yr",      recentDecade: "~11%/yr"      },
  sp500:         { longTerm: "~7–10%/yr",      recentDecade: "~13%/yr"      },
  nasdaq100:     { longTerm: "~10–12%/yr",     recentDecade: "~18%/yr"      },
  tlv125:        { longTerm: "~8%/yr (NIS)",   recentDecade: "~8%/yr (NIS)" },
} as const;

export const MONEY_MARKET_YIELD = "~4–5%/yr (current approximate yield, tracks monetary policy)";
```

**Preferences prompt framing:** Present the long-term average as the baseline. Note the past decade explicitly as "stronger than the long-term average." The NASDAQ 2022 drawdown reference (~33% down) is kept — it illustrates volatility, not return expectation.

---

## 5. Intake Phases: out-of-scope and unrealistic

### `clarify.out-of-scope.ts`

Specify redirect content in the prompt:
- Explain *why*: a single stock concentrates all risk in one company — a significant drop or setback affects the entire investment. A diversified ETF spreads risk across hundreds of companies.
- Offer a sector ETF as middle ground: if the user has a sector preference (e.g., tech), NASDAQ-100 provides that exposure without single-company risk.
- End with an explicit yes/no question: "Would you like to build a plan around ETFs instead?"

**Eval additions:**
- Multi-turn accepted: user pushes back ("why can't I just buy the stock?"), then accepts on second turn
- Ambiguous first response ("maybe, what's an ETF?"): accepted on second turn
- Partial acceptance with crypto mention: `accepted: true` (ETF path taken)
- Hard rejection: user doubles down after explanation → `accepted: false`

### `clarify.unrealistic.ts`

Compute the implied annualized return from the user's stated goal (amount, target, timeline) and compare to the long-term passive average (~7–10% for S&P 500). Do not use a fixed percentage threshold.

Example framing: "You want ₪50K → ₪200K in 3 years — that requires ~59% annually. Passive ETFs have averaged ~7–10% long-term."

Use the rule of 72 to show what is achievable: "At 10%, your ₪50K doubles in ~7 years."

**Eval additions:**
- Multi-turn: user challenges the explanation ("I've seen people get rich quickly online"), then accepts a long-term plan on second turn
- Ambiguous ("I'll think about it"): accepted on second turn
- Hard rejection: user insists on >100% returns → `accepted: false`
