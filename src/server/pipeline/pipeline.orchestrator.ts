import { runWithSession } from "#lib/session-context";
import { runClarify } from "#pipeline/stages/clarify/clarify.orchestrator";
import type { Responder } from "#pipeline/tools/ask-user.tool";
import { PipelineStatusEnum } from "#schemas/pipeline.schemas";

export const runPipeline = async (
  sessionId: string,
  goal: string,
  responder: Responder,
): Promise<void> => {
  return runWithSession(sessionId, async () => {
    const result = await runClarify(goal, responder);
    if (result.status !== PipelineStatusEnum.enum.completed) {
      responder.sendToUser(result.message);

      return;
    }

    // Future stages slot in here, consuming result.profile. The last stage's
    // `completed` arm will send the final formatted output via responder.sendToUser;
    // runPipeline returns void either way.
  });
};
