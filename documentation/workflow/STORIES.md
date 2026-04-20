# Lazy Advisor — Usage Stories

Realistic scenarios showing how the CLI works in practice. MVP scope: single sessions, clarify stage only.

The agent is **educational by default** — it explains concepts inline so beginner investors understand *why*, not just *what*. Every recommendation comes with reasoning the user can learn from.

All users are based in Israel. The agent tailors recommendations to Israeli investors: Irish-domiciled accumulating ETFs for tax efficiency, Israeli brokerages (Meitav, IBI, Excellence) vs Interactive Brokers, קרנות מחקות for local exposure, and shekel-denominated amounts.

---

## Agent Behavior Principles

- The agent asks only for gaps — no fixed checklist. Detailed input skips clarification entirely.
- The agent does the research; steps are human actions only. "Research VGT vs QQQ" is never a step — the agent searches, synthesizes, and produces specific opinionated recommendations.

---

## Story 1: The happy path — complete beginner

**Goal:** "I have ₪55,000 and I want to start investing but I have no idea where to begin"

**Stage 1 — Clarify:** The agent identifies gaps (age, timeline, risk, emergency fund, debt, monthly contribution, brokerage) and asks in a single message. The user answers with a 20-year horizon and stress-but-hold risk response, which the agent maps to moderate. Because no investment preferences were stated, the agent asks the portfolio defaults question: equity allocation options with compound projections, plus a קרן כספית suggestion for the buffer. The user picks 70% FTSE All-World + 30% TLV-125 with קרן כספית. Stage completes.


---

## Story 2: Out-of-scope goal — stock redirect

**Goal:** "Should I buy NVIDIA stock?"

**Stage 1 — Clarify (intake):** The agent classifies the goal as `out_of_scope`. It delivers a redirect-only message first (no data-collection questions in the same turn): buying a single stock concentrates all risk in one company, whereas a diversified ETF spreads that risk across hundreds. Offers a sector ETF as a middle ground if the user has a sector preference.

**User accepts the ETF approach.** The intake phase returns silently (internal signal only). Field collection begins, chaining from the intake response. The agent asks for remaining gaps and builds a full profile. The goal is restated in ETF terms.

---

## Story 3: Unrealistic expectations — reality check redirect

**Goal:** "I have ₪18,000 and I want to double it in 6 months"

**Stage 1 — Clarify (intake):** The agent classifies the goal as `unrealistic`. It delivers a redirect-only message: doubling capital in 6 months requires ~100% returns, which is not achievable with passive ETF investing — even aggressive ETFs return ~15–18%/yr on average. Asks if the user would like to proceed with a realistic long-term plan instead.

**User accepts.** The intake phase returns silently (internal signal only). Field collection begins, chaining from the intake response. The user pivots to a 10–15 year horizon. The agent asks for remaining gaps and builds a full profile.

---

## Story 4: Contradictory goal — risk resolution

**Goal:** "I want maximum returns but I can't afford to lose any money"

**Stage 1 — Clarify (intake):** The agent classifies the goal as `contradictory` — maximum returns and capital safety are fundamentally incompatible. It presents a concrete loss scenario to surface real risk tolerance: "If your portfolio dropped 20% in a year — say ₪18,000 became ₪14,400 — would you (A) sell to stop further losses, (B) hold and wait for recovery, or (C) buy more while prices are low?" The user answers B. The agent maps this to `moderate` and returns the internal signal `Got it.` to proceed.

*Note: this intake handles contradictions stated upfront in the initial goal. Mid-conversation contradictions that emerge while answering the risk question are handled inline by the fields phase (CLARIFY_RULES #2).*

**Field collection begins**, chaining from the intake response (the intake phase returned silently with an internal signal). Risk tolerance is already resolved — the fields phase does not re-ask it.

---

## Story 5: User rejects intake redirect

Applies to any of the three intake classifications (`out_of_scope`, `unrealistic`, `contradictory`).

**Goal:** "Should I buy NVIDIA stock?"

**Stage 1 — Clarify (intake):** The agent classifies the goal as `out_of_scope` and delivers the ETF redirect.

**User declines:** "No, I only want NVIDIA, not interested in ETFs at all."

The agent sends a classification-specific closing message: "No problem — feel free to come back when you're ready to explore ETF-based investing." No profile is produced and the pipeline ends immediately.

*The same pattern applies to `unrealistic` and `contradictory` rejections — each has its own closing message tailored to the classification.*

