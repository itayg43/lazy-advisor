# Clarify Contribution Phase — Behavior Rules

Behavioral rules for the contribution phase. This phase resolves one boolean: whether the user plans to add money to their portfolio periodically after the initial investment.

---

## 1. Explicit yes → true immediately

**Rule:** If the user clearly says they plan to contribute periodically, accept `true` and end the phase.

**Scenario:** "Yes, I plan to add around ₪500 every month."

**Extracted:** plansToContribute: true

---

## 2. Explicit no → false immediately

**Rule:** If the user clearly says they will not be adding money periodically, accept `false` and end the phase — no follow-up.

**Scenario:** "No, this is a one-time investment."

**Extracted:** plansToContribute: false

---

## 3. Vague or uncertain → acknowledge briefly, then resolve to false

**Rule:** Any answer that is not a clear "yes" — including "not sure", "maybe", "I don't know", "sometimes", "possibly" — resolves to `false`. Acknowledge briefly so the user doesn't feel cut off, then end the phase. Do not re-ask.

**Acknowledgment to use:** "No problem — you can always start with a one-time investment and add more later when you're ready." Send this via `ask_user` and stop calling tools immediately — do not respond to any follow-up from the user.

**Scenario:** "Maybe someday, but not regularly."

**Extracted:** plansToContribute: false

---

## 4. User asks what DCA or periodic contributing means → explain the benefit, then re-ask

**Rule:** If the user asks for clarification on the question itself (e.g., "what does that mean?", "what's DCA?", "what does contributing periodically mean?"), give a beginner-friendly explanation that covers both the mechanics and the benefit — then re-ask the original question. Do not treat the clarification request as a yes or no answer.

**Example explanation (adapt to how the user asked):** "It means adding a fixed amount — like ₪300 or ₪500 — to your investment every month or quarter, on top of what you're investing now. The main benefit is that you buy more units when prices are low and fewer when prices are high, which smooths out the effect of market swings over time. It also builds the habit of saving regularly, which compounds significantly over years. So — do you think you'd want to add money periodically, or is this a one-time investment for now?"

**Scenario:** User asks "what does contributing mean?" → agent explains → user answers yes/no.

---

## 5. User raises Israel-specific concerns (fractional shares, small amounts) → address the concern accurately, then re-ask

**Rule:** If the user mentions that contributing periodically seems impractical due to small amounts or not being able to buy partial ETF units in Israel, address the concern accurately without dismissing it or validating skipping contributions as equally good. Brokerage fees are not a meaningful barrier — you only pay them once per purchase (at most once a month, often less), and the cost is a few shekels per trade regardless of ETF type — do not raise or validate fees as a concern. The real constraint is fractional shares: Israeli brokerages generally don't support fractional ETF units, so you need enough to buy at least one full unit. The practical workaround is accumulating savings for a few months and investing quarterly. Re-ask after explaining.

**Example response (adapt to the user's specific concern):** "The main practical consideration in Israel is that most brokerages don't support fractional ETF units — so you need enough saved up to buy at least one full unit at a time. The common workaround is to accumulate a few months of savings and invest quarterly rather than monthly. As for fees — you only pay them once per purchase, which is at most once a month or even less, and the cost is just a few shekels per trade, so it's not a real barrier. So — do you think you'd want to invest periodically (even if quarterly rather than monthly), or is this a one-time investment for now?"

**Scenario:** "In Israel you can't buy partial ETF shares so it's hard to invest small amounts regularly." → agent addresses concern with practical context → user answers.

---

## Last-run review

After every eval run, open `clarify.contribution.last-run.md` and check the following tests:

**"should explain DCA when asked and return true after user confirms"**
- Agent's **second turn** (DCA explanation) should reference the actual equity and/or buffer shekel amounts (e.g., ₪21,000 equity / ₪9,000 buffer for the default mock fixtures).
- Fail signal: explanation uses only generic amounts (e.g., "₪300 or ₪500") with no reference to the user's actual split.

**"should address fractional share concern and return true after user confirms"**
- Agent's **second turn** (Israel-specific response) should reference the actual equity and/or buffer shekel amounts.
- Fail signal: same as above.

