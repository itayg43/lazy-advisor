import { createLogger } from "#lib/logger";
import { MAX_CONTRIBUTION_TOOL_CALLS } from "#pipeline/stages/clarify/shared/clarify.constants";
import {
  runPhaseExtraction,
  runPhaseLoop,
} from "#pipeline/stages/clarify/shared/clarify.lib";
import { ContributionPhaseOutputSchema } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  AllocationPhaseOutput,
  ContributionPhaseOutput,
  FieldsPhaseOutput,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

const logger = createLogger("clarifyContribution");

const CONTRIBUTION_PROMPT = `# Role and Objective
You are the contribution phase of an investment advisor pipeline. Your sole responsibility is to determine whether the user plans to add money to their portfolio periodically after their initial investment. Do **not** provide investment advice, portfolio suggestions, or fund names.

# Turn 1 — Initial Question
You have not yet asked the user anything. Send exactly this question via the \`ask_user\` tool:
"After your initial investment, do you plan to add money to your portfolio periodically — for example, every month or quarter?"

# Turn 2+ — Processing the User's Response
The user has now responded. All replies — including re-asks after an explanation — must be sent via the \`ask_user\` tool. Never output a question as plain text.

**Before matching any case below:** scan the user's message for these words: "Israel", "Israeli", "fractional", "partial shares", "partial ETF", "partial units", "small amounts". If any are present, go directly to Case 1 — do not evaluate Cases 2–5.

Otherwise, evaluate the cases below in order and execute the first match.

**Case 1 — Israel-specific concern (fractional shares, small amounts)**
Triggered when: user mentions Israel, Israeli brokerages, fractional ETF units, partial shares, minimum purchase sizes, or difficulty investing small amounts.
Your response must be a full explanation paragraph followed by a separate re-ask — do not fold the explanation into the question as a parenthetical or a single sentence. The explanation must include the user's actual equity and buffer shekel amounts from the input context (e.g. "With your ₪21,000 equity and ₪9,000 buffer...") — do not omit them. Cover: the real constraint is fractional shares (Israeli brokerages generally don't support fractional ETF units, so you need enough to buy at least one full unit); brokerage fees are not a meaningful barrier (a few shekels per trade, paid at most once a month or less); the practical workaround is accumulating savings and investing quarterly. Do not validate skipping contributions as equally good. Then re-ask.
Do not write: "After your initial investment, do you plan to add money periodically? (Given the usual workaround is accumulating savings and investing quarterly, would you want to do that?)" — this compresses the explanation into a parenthetical and omits the required equity/buffer amounts.
Example (adapt tone and phrasing; replace equity/buffer with actual values from the input context): "The main practical consideration in Israel is that most brokerages don't support fractional ETF units — so you need enough saved up to buy at least one full unit at a time. With your ₪[equity] equity and ₪[buffer] buffer in mind, the common workaround is to accumulate a few months of savings and invest quarterly rather than monthly. As for fees — you only pay them once per purchase, which is at most once a month or even less, and the cost is just a few shekels per trade, so it's not a real barrier. So — do you think you'd want to invest periodically (even if quarterly rather than monthly), or is this a one-time investment for now?"

**Case 2 — Clarification question about DCA or periodic contributing**
Triggered when: user asks what DCA means, what "periodically" means, or asks for any clarification about the question itself.
Give a beginner-friendly explanation in 2 sentences: one for mechanics (reference the user's actual equity amount from the input context — do not use generic placeholder amounts), one for the benefit. Then re-ask the original question.
Example (adapt tone and phrasing, use actual equity amount from context): "It means adding a fixed amount to your ₪[equity amount] equity position every month or quarter. The main benefit is that you buy more units when prices are low and fewer when prices are high, which smooths out the effect of market swings over time. So — do you think you'd want to add money periodically, or is this a one-time investment for now?"

**Case 3 — Clear yes**
Triggered when: user confirms they plan to contribute periodically → end the phase.

**Case 4 — Clear no**
Triggered when: user confirms this is a one-time investment → end the phase.

**Case 5 — Vague or uncertain answer**
Triggered when: any answer that is not a clear "yes" — including "not sure", "maybe", "I don't know", "sometimes", "possibly".
Send the following via \`ask_user\`: "No problem — you can always start with a one-time investment and add more later when you're ready." Then stop calling tools and end the phase (resolve to false). Do not respond to any follow-up from the user.`;

const CONTRIBUTION_EXTRACTION_INSTRUCTIONS = `Extract a structured record from the preceding investment advisor conversation.

- plansToContribute: true if the user confirmed they plan to add money periodically, false otherwise (explicit no, vague answer, or no clear signal)`;

export const collectContribution = async (
  fields: FieldsPhaseOutput,
  allocation: AllocationPhaseOutput,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<ContributionPhaseOutput> => {
  logger.info("Starting contribution phase", { fields, allocation });

  const equityAmount = Math.round((fields.amount * allocation.equityPercentage) / 100);
  const bufferAmount = fields.amount - equityAmount;

  const context = `Investment amount: ₪${fields.amount.toLocaleString()}
Investment timeline: ${fields.timeline}
Allocation: ${allocation.equityPercentage}% equity (₪${equityAmount.toLocaleString()}), ${allocation.bufferPercentage}% buffer (₪${bufferAmount.toLocaleString()})`;

  const { responseId } = await runPhaseLoop({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions: CONTRIBUTION_PROMPT,
    input: context,
    maxToolCalls: MAX_CONTRIBUTION_TOOL_CALLS,
    phaseName: "Contribution phase",
    sendToUser,
    waitForResponse,
  });

  const { id, usage, output } = await runPhaseExtraction<ContributionPhaseOutput>({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions: CONTRIBUTION_EXTRACTION_INSTRUCTIONS,
    lastResponseId: responseId,
    schema: ContributionPhaseOutputSchema,
  });

  logger.info("Contribution extraction complete", { responseId: id, usage });
  logger.debug("Contribution output", { output });

  return output;
};
