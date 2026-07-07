import { runWithSession } from "#lib/session-context";
import { runClarifyOrchestrator } from "#pipeline/stages/clarify/clarify.orchestrator";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

export const runPipelineOrchestrator = async (
  sessionId: string,
  goal: string,
  responder: Responder,
): Promise<void> => {
  return runWithSession(sessionId, async () => {
    const clarifyResult = await runClarifyOrchestrator(goal, responder);
    if (clarifyResult.status !== PipelineStatusEnum.enum.completed) {
      responder.sendToUser(clarifyResult.message);

      return;
    }

    // Future stages slot in here, consuming clarifyResult.profile. The last stage's
    // `completed` arm will send the final formatted output via responder.sendToUser;
    // runPipelineOrchestrator returns void either way.
  });
};
