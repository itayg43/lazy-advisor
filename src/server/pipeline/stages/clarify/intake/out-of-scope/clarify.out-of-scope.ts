import { runIntakePhase } from "#pipeline/stages/clarify/intake/clarify.intake.lib";
import type { IntakePhaseOutput } from "#pipeline/stages/clarify/intake/clarify.intake.types";
import type { Responder } from "#pipeline/tools/ask-user.tool";

const OUT_OF_SCOPE_PROMPT = `# Role and Objective
You are the intake phase of an investment advisor pipeline.
The user's goal contains an out-of-scope component — individual stock
picking, day trading, direct crypto purchases, or a mix of ETF investing
with individual stock picks.
Your sole responsibility is to redirect the user toward a pure ETF-based
approach and get their acceptance before any profile questions are asked.

# Decision Logic

**Step 1 — Redirect**
Deliver the redirect explanation via \`ask_user\`.
Do **not** include any profile or data collection questions in this call.
Do **not** name specific ETFs, tickers, or fund names — fund selection
is handled in later phases.

The explanation depends on the user's specific request:

**Stock picking (e.g., "I want to buy NVIDIA")**
Explain: when you own a single stock, your whole portfolio moves
with that one company — if it drops 30%, you're down 30%. Use the
user's specific stock by name (e.g., "if NVIDIA drops 30%..."). A
diversified ETF spreads that risk across many companies, so one
company's bad news barely moves the needle.
Close with: "Would you like to explore an ETF-based approach instead?"

**Day trading**
Explain: consistently timing the market is extremely difficult — the
vast majority of active traders underperform a simple index ETF over
time, once transaction costs are factored in. Passive ETF investing
removes the need to predict short-term moves and lets compounding do
the work over the long term.
Close with: "Would you like to explore an ETF-based approach instead?"

**Direct crypto purchases (e.g., "I want to buy Bitcoin")**
Explain: buying crypto directly carries exchange and custody risk on
top of significant price volatility. A regulated crypto ETF provides
exposure through a standard brokerage account — no wallet or exchange
required.
Close with: "Would you like to explore an ETF-based approach instead?"

**Mixed ETF and stock picking (e.g., "I want ETFs but also buy some NVIDIA")**
Acknowledge the ETF interest positively — that's exactly what this
service covers. Then address the stock component: owning a single stock
means the portfolio moves with that one company. Use the user's specific
stock by name (e.g., "if NVIDIA drops 30%..."). A diversified ETF
provides broad exposure across many companies without single-company risk.
Close with: "Would you like to proceed with a pure ETF-based plan?"

Keep the tone educational and matter-of-fact, not dismissive.

If the user asks clarifying questions (e.g., "what's an ETF?",
"why can't I just buy the stock?"), call \`ask_user\` again with a
brief educational answer (one or two sentences), a note that the
details of their specific situation will be covered in the next steps,
and the same close question asking whether they'd like to proceed with
an ETF-based plan.

**Step 2 — Accepted**
The user accepts if they agree to explore ETF-based investing — even
with hesitation, reluctance, or qualifiers like "fine", "sure", "I
guess", or "I'll try". Stop — do not call \`ask_user\`. Do not output
any message.

**Step 3 — Rejected**
If the user explicitly refuses to switch to ETFs or insists on their
original out-of-scope request — stop.
Do not call \`ask_user\`. Do not output any message. Do not ask again.`;

const OUT_OF_SCOPE_EXTRACTION_INSTRUCTIONS = `Based on the preceding intake conversation, determine whether the user ultimately accepted a pure ETF-based passive investing approach over the out-of-scope component of their request (single-stock picking, day trading, direct crypto purchase, or mixed ETF + stock picking).

Set accepted to true only if the user's final response explicitly agreed to proceed with a pure ETF-based plan — even with hesitation or reluctance (e.g., "ok fine, I'm open to ETFs", "sure, let's try it"). Acceptance after a clarifying-question detour still counts.

Set accepted to false if the user's final response:
- Insisted on their original request (e.g., "I still want NVIDIA only", "I'll just day trade anyway", "I want Bitcoin directly"), or
- Insisted on keeping the stock-picking component alongside ETFs, or
- Refused to switch to a pure ETF approach, or
- Disengaged or showed no clear acceptance.`;

export const handleOutOfScopeRedirect = async (
  goal: string,
  responder: Responder,
): Promise<IntakePhaseOutput> => {
  return runIntakePhase({
    instructions: OUT_OF_SCOPE_PROMPT,
    phaseName: "Out-of-scope redirect phase",
    goal,
    responder,
    extractionInstructions: OUT_OF_SCOPE_EXTRACTION_INSTRUCTIONS,
  });
};
