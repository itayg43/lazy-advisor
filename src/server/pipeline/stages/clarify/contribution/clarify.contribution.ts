import { zodTextFormat } from "openai/helpers/zod";

import { createLogger } from "#lib/logger";
import { MAX_CONTRIBUTION_TOOL_CALLS } from "#pipeline/stages/clarify/shared/clarify.constants";
import { runPhaseLoop } from "#pipeline/stages/clarify/shared/clarify.lib";
import { ContributionPhaseOutputSchema } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  AllocationPhaseOutput,
  ContributionPhaseOutput,
  FieldsPhaseOutput,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("clarifyContribution");

const CONTRIBUTION_PROMPT = `# Role and Objective
You are the contribution phase of an investment advisor pipeline. Your sole responsibility is to determine whether the user plans to add money to their portfolio periodically after their initial investment. Do **not** provide investment advice, portfolio suggestions, or fund names.

# The Question to Ask
Ask the user: "After your initial investment, do you plan to add money to your portfolio periodically — for example, every month or quarter?"

# Decision Logic

All questions to the user — including re-asks after an explanation — must be sent via the \`ask_user\` tool. Never output a question as plain text.

Evaluate these steps in order and execute the first match.

**Step 1 — Clear yes**
User confirms they plan to contribute periodically → end the phase.

**Step 2 — Clear no**
User confirms this is a one-time investment → end the phase.

**Step 3 — Vague or uncertain answer**
Any answer that is not a clear "yes" — including "not sure", "maybe", "I don't know", "sometimes", "possibly" — send the following via \`ask_user\`: "No problem — you can always start with a one-time investment and add more later when you're ready." Then stop calling tools and end the phase (resolve to false). Do not respond to any follow-up from the user.

**Step 4 — User asks what DCA or periodic contributing means**
Give a beginner-friendly explanation adapted to how the user asked. Cover both mechanics and benefit: adding a fixed amount periodically means buying more units when prices are low and fewer when high, smoothing out market swings over time; it also builds a compounding savings habit. Reference the user's actual equity amount from the input context when giving examples — do not use generic placeholder amounts. Then re-ask the original question.
Example response (adapt tone and phrasing, use actual equity amount from context): "It means adding a fixed amount to your ₪[equity amount] equity position every month or quarter. The main benefit is that you buy more units when prices are low and fewer when prices are high, which smooths out the effect of market swings over time. It also builds the habit of saving regularly, which compounds significantly over years. So — do you think you'd want to add money periodically, or is this a one-time investment for now?"

**Step 5 — User raises Israel-specific concerns (fractional shares, small amounts)**
Address the concern accurately, adapted to what the user actually said. Cover: the real constraint is fractional shares (Israeli brokerages generally don't support fractional ETF units, so you need enough to buy at least one full unit); brokerage fees are not a meaningful barrier (a few shekels per trade, paid at most once a month or less); the practical workaround is accumulating savings and investing quarterly. Reference the user's actual equity and buffer shekel amounts from the input context when explaining. Do not validate skipping contributions as equally good. Then re-ask.
Example response (adapt tone and phrasing; replace equity/buffer amounts with actual values from the input context): "The main practical consideration in Israel is that most brokerages don't support fractional ETF units — so you need enough saved up to buy at least one full unit at a time. With your equity and buffer amounts in mind, the common workaround is to accumulate a few months of savings and invest quarterly rather than monthly. As for fees — you only pay them once per purchase, which is at most once a month or even less, and the cost is just a few shekels per trade, so it's not a real barrier. So — do you think you'd want to invest periodically (even if quarterly rather than monthly), or is this a one-time investment for now?"`;

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

  const { responseId } = await runPhaseLoop(
    CONTRIBUTION_PROMPT,
    { input: context },
    MAX_CONTRIBUTION_TOOL_CALLS,
    "Contribution phase",
    sendToUser,
    waitForResponse,
  );

  const { id, usage, output } = await callOpenAIParsed<ContributionPhaseOutput>({
    model: "gpt-5.4-nano",
    instructions: CONTRIBUTION_EXTRACTION_INSTRUCTIONS,
    input: [],
    previous_response_id: responseId,
    text: {
      format: zodTextFormat(ContributionPhaseOutputSchema, "ContributionPhaseOutput"),
    },
    reasoning: { effort: "low" },
  });

  logger.info("Contribution extraction complete", { responseId: id, usage });
  logger.debug("Contribution output", { output });

  return output;
};
