# Clarify Contribution Phase — Behavior Rules

Behavioral rules for the contribution phase. This phase resolves one boolean: whether the user plans to add money to their portfolio periodically after the initial investment.

Cases are evaluated in priority order. Israel-specific concerns and clarification questions are handled before yes/no resolution.

---

## 1. User raises Israel-specific concerns (fractional shares, small amounts) → address the concern accurately, then re-ask

**Rule:** If the user mentions that contributing periodically seems impractical due to small amounts or not being able to buy partial ETF units in Israel, address the concern accurately before re-asking. Response must be a full explanation paragraph — do not compress it into a parenthetical alongside the question. The explanation must reference the user's actual equity and buffer shekel amounts from context. Do not validate skipping contributions as equally good.

Cover: the real constraint is fractional shares (Israeli brokerages generally don't support fractional ETF units, so you need enough to buy at least one full unit); brokerage fees are not a meaningful barrier (a few shekels per trade, paid at most once a month or less); the practical workaround is accumulating savings for a few months and investing quarterly.

**Example response (adapt to the user's specific concern; replace equity/buffer with actual amounts):** "The main practical consideration in Israel is that most brokerages don't support fractional ETF units — so you need enough saved up to buy at least one full unit at a time. With your ₪[equity] equity and ₪[buffer] buffer in mind, the common workaround is to accumulate a few months of savings and invest quarterly rather than monthly. As for fees — you only pay them once per purchase, which is at most once a month or even less, and the cost is just a few shekels per trade, so it's not a real barrier. So — do you think you'd want to invest periodically (even if quarterly rather than monthly), or is this a one-time investment for now?"

**Scenario:** "In Israel you can't buy partial ETF shares so it's hard to invest small amounts regularly." → agent addresses concern with practical context → user answers.

---

## 2. User asks what DCA or periodic contributing means → explain in 2 sentences, then re-ask

**Rule:** If the user asks for clarification on the question itself (e.g., "what does that mean?", "what's DCA?", "what does contributing periodically mean?"), give a beginner-friendly explanation in exactly 2 sentences: one for mechanics (referencing the user's actual equity amount from context — not generic placeholder amounts), one for the benefit. Then re-ask the original question. Do not treat the clarification request as a yes or no answer.

**Example explanation (adapt to how the user asked; use actual equity amount):** "It means adding a fixed amount to your ₪[equity] equity position every month or quarter. The main benefit is that you buy more units when prices are low and fewer when prices are high, which smooths out the effect of market swings over time. So — do you think you'd want to add money periodically, or is this a one-time investment for now?"

**Scenario:** User asks "what does contributing mean?" → agent explains → user answers yes/no.

---

## 3. Explicit yes → true immediately

**Rule:** If the user clearly says they plan to contribute periodically, accept `true` and end the phase.

**Scenario:** "Yes, I plan to add around ₪500 every month."

**Extracted:** plansToContribute: true

---

## 4. Explicit no → false immediately

**Rule:** If the user clearly says they will not be adding money periodically, accept `false` and end the phase — no follow-up.

**Scenario:** "No, this is a one-time investment."

**Extracted:** plansToContribute: false

---

## 5. Vague or uncertain → acknowledge briefly, then resolve to false

**Rule:** Any answer that is not a clear "yes" — including "not sure", "maybe", "I don't know", "sometimes", "possibly" — resolves to `false`. Acknowledge briefly so the user doesn't feel cut off, then end the phase. Do not re-ask.

**Acknowledgment to use:** "No problem — you can always start with a one-time investment and add more later when you're ready." Send this via `ask_user` and stop calling tools immediately — do not respond to any follow-up from the user.

**Scenario:** "Maybe someday, but not regularly."

**Extracted:** plansToContribute: false

---

## Last-run review

Context enrichment checks (actual shekel amounts in explanation turns) are now automated assertions in the eval — no manual review needed for those.
