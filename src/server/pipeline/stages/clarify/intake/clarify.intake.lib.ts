import { createLogger } from "#lib/logger";
import { MAX_INTAKE_TOOL_CALLS } from "#pipeline/stages/clarify/shared/clarify.constants";
import {
  runPhaseExtraction,
  runPhaseLoop,
} from "#pipeline/stages/clarify/shared/clarify.lib";
import { IntakePhaseOutputSchema } from "#pipeline/stages/clarify/shared/clarify.schemas";
import type { IntakePhaseOutput } from "#pipeline/stages/clarify/shared/clarify.types";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

const logger = createLogger("clarifyIntake");

export const runIntakePhase = async (
  instructions: string,
  phaseName: string,
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
  extractionInstructions: string,
): Promise<IntakePhaseOutput> => {
  logger.info(`Starting ${phaseName}`);

  const { responseId } = await runPhaseLoop({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions,
    input: goal,
    maxToolCalls: MAX_INTAKE_TOOL_CALLS,
    phaseName,
    sendToUser,
    waitForResponse,
  });

  const { output, usage } = await runPhaseExtraction<IntakePhaseOutput>({
    model: "gpt-5.4-nano",
    effort: "low",
    instructions: extractionInstructions,
    lastResponseId: responseId,
    schema: IntakePhaseOutputSchema,
  });

  logger.info(`${phaseName} extraction complete`, { accepted: output.accepted, usage });

  return output;
};
