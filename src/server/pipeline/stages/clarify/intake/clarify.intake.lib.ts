import { createLogger } from "#lib/logger";
import { MAX_INTAKE_TOOL_CALLS } from "#pipeline/stages/clarify/intake/clarify.intake.constants";
import { IntakePhaseOutputSchema } from "#pipeline/stages/clarify/intake/clarify.intake.schemas";
import type { IntakePhaseOutput } from "#pipeline/stages/clarify/intake/clarify.intake.types";
import {
  runPhaseExtraction,
  runPhaseLoop,
} from "#pipeline/stages/clarify/shared/clarify.phase";
import type { Responder } from "#pipeline/tools/ask-user.tool";

const logger = createLogger("clarifyIntake");

export const runIntakePhase = async (
  instructions: string,
  phaseName: string,
  goal: string,
  responder: Responder,
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
    responder,
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
