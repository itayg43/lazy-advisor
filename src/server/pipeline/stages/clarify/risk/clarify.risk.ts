import { zodTextFormat } from "openai/helpers/zod";

import { createLogger } from "#lib/logger";
import { MAX_RISK_TOOL_CALLS } from "#pipeline/stages/clarify/shared/clarify.constants";
import {
  buildRiskScenario,
  runPhaseLoop,
} from "#pipeline/stages/clarify/shared/clarify.lib";
import { RiskPhaseOutputSchema } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { RiskPhaseOutput } from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { RiskTolerance } from "#schemas/pipeline.schema";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("clarifyRisk");

const RISK_DROP_PERCENTAGE = 20;

const { conservative, moderate, aggressive } = RiskTolerance.enum;

const RISK_PROMPT_HEADER = `# Role and Objective
You are the risk-tolerance phase of an investment advisor pipeline. Your sole responsibility is to determine how the user would respond to a significant market downturn. Do **not** provide investment advice, portfolio suggestions, or fund names. Do **not** mention internal risk labels (${conservative}, ${moderate}, ${aggressive}) to the user at any point.

# The Scenario to Present
Present this scenario to the user via the \`ask_user\` tool:`;

const RISK_PROMPT_BODY = `
# Decision Logic

All questions to the user — including re-asks after explanations — must be sent via the \`ask_user\` tool. Never output a question as plain text.

Evaluate these steps in order and execute the first match.

**Step 1 — User picks A (sell)**
User says they would sell or exit the position → end the phase immediately.

**Step 2 — User picks B (stay invested) → follow-up**
User says they would stay invested → ask: "Would you find that stressful to watch, or would you stay pretty calm?"
- Follow-up: stressed or anxious → end the phase.
- Follow-up: calm or unbothered → end the phase.

**Step 3 — First "I don't know" or uncertain answer**
User gives a vague or uncertain answer ("I don't know", "not sure", "hard to say") for the first time → give a brief educational explanation of why this matters, help them picture the scenario concretely, then re-ask once. Do not end the phase yet.

Example explanation (adapt tone and phrasing): "That's a common feeling — it's hard to know until it happens. The reason it matters is that your tolerance for short-term losses should influence how your portfolio is structured. If a ${RISK_DROP_PERCENTAGE}% drop would make you anxious to the point of wanting to sell, a more conservative mix reduces those swings. If you think you'd weather it without panic, you can take on more growth-oriented funds. Try to picture it: your portfolio is down on paper. What's your gut reaction — sell to stop the bleeding, or stay invested and trust the recovery?"

**Step 4 — Market-timing answer**
User says they would evaluate based on news, economic conditions, or what the market is likely to do → explain why market timing is unreliable, then re-ask the original A/B scenario.

Example explanation (adapt tone and phrasing): "That's a natural instinct, but research consistently shows that trying to time the market — selling before it falls further or buying at the bottom — usually backfires. Even professional fund managers underperform simple index strategies over the long run. The question is really about your default behavior when you have no certainty: if your portfolio was down and you had no idea whether it would recover next month or in three years, would your instinct be to sell, or to stay invested?"

**Step 5 — Still uncertain after the educational fallback was already given**
The educational explanation has already been given once and the user is still uncertain → end the phase immediately. Do not ask again. The extraction call will default to ${conservative}.`;

const RISK_EXTRACTION_INSTRUCTIONS = `Extract a structured record from the preceding investment advisor conversation about market downturn behavior.

- riskTolerance: infer from the conversation outcome:
  - "${conservative}": user chose to sell (option A), or gave no clear signal after multiple turns
  - "${moderate}": user chose to stay invested (option B) but expressed stress or anxiety about watching the drop
  - "${aggressive}": user chose to stay invested (option B) and expressed calm or indifference to the drop`;

export const collectRisk = async (
  amount: number,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<RiskPhaseOutput> => {
  logger.info("Starting risk phase", { amount });

  const scenario = buildRiskScenario(amount, RISK_DROP_PERCENTAGE);
  const prompt = `${RISK_PROMPT_HEADER}\n\n${scenario}${RISK_PROMPT_BODY}`;

  const { responseId } = await runPhaseLoop(
    prompt,
    { input: `Investment amount: ₪${amount.toLocaleString()}` },
    MAX_RISK_TOOL_CALLS,
    "Risk phase",
    sendToUser,
    waitForResponse,
  );

  const { id, usage, output } = await callOpenAIParsed<RiskPhaseOutput>({
    model: "gpt-5.4-nano",
    instructions: RISK_EXTRACTION_INSTRUCTIONS,
    input: [],
    previous_response_id: responseId,
    text: { format: zodTextFormat(RiskPhaseOutputSchema, "RiskPhaseOutput") },
    reasoning: { effort: "low" },
  });

  logger.info("Risk extraction complete", { responseId: id, usage });
  logger.debug("Risk output", { output });

  return output;
};
