import { zodTextFormat } from "openai/helpers/zod";

import { createLogger } from "#lib/logger";
import {
  DROP_TURN_1,
  DROP_TURN_2,
  EXTRACTION_INSTRUCTIONS,
  INSTRUCTIONS,
} from "#pipeline/stages/clarify/risk/clarify.risk.prompts";
import { MAX_RISK_TOOL_CALLS } from "#pipeline/stages/clarify/shared/clarify.constants";
import { runPhaseLoop } from "#pipeline/stages/clarify/shared/clarify.lib";
import { RiskPhaseOutputSchema } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type {
  FieldsPhaseOutput,
  RiskPhaseOutput,
} from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";
import { callOpenAIParsed } from "#services/openai";

const logger = createLogger("clarifyRisk");

const computeDropAmount = (amount: number, dropPercentage: number): number =>
  Math.round(amount * (dropPercentage / 100));

export const collectRisk = async (
  goal: string,
  fields: FieldsPhaseOutput,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<RiskPhaseOutput> => {
  logger.info("Starting risk phase", { goal, fields });

  const drop1Amount = computeDropAmount(fields.amount, DROP_TURN_1);
  const drop2Amount = computeDropAmount(fields.amount, DROP_TURN_2);

  const context = [
    `User goal: ${goal}`,
    `Investment amount: ₪${fields.amount.toLocaleString()}`,
    `Investment timeline: ${fields.timeline}`,
    `${DROP_TURN_1}% drop amount: ₪${drop1Amount.toLocaleString()}`,
    `${DROP_TURN_2}% drop amount: ₪${drop2Amount.toLocaleString()}`,
  ].join("\n");

  const { responseId } = await runPhaseLoop(
    INSTRUCTIONS,
    { input: context },
    MAX_RISK_TOOL_CALLS,
    "Risk phase",
    sendToUser,
    waitForResponse,
  );

  const { id, usage, output } = await callOpenAIParsed<RiskPhaseOutput>({
    model: "gpt-5.4-nano",
    instructions: EXTRACTION_INSTRUCTIONS,
    input: [],
    previous_response_id: responseId,
    text: { format: zodTextFormat(RiskPhaseOutputSchema, "RiskPhaseOutput") },
    reasoning: { effort: "low" },
  });

  logger.info("Risk extraction complete", { responseId: id, usage });
  logger.debug("Risk output", { output });

  return output;
};
