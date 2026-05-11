import { runWithSession } from "#lib/session-context";
import { runClarifyOrTerminate } from "#pipeline/stages/clarify/clarify.orchestrator";
import type { Responder } from "#pipeline/tools/ask-user.tool";

export const runPipeline = async (
  sessionId: string,
  goal: string,
  responder: Responder,
): Promise<void> => {
  return runWithSession(sessionId, async () => {
    const profile = await runClarifyOrTerminate(goal, responder);
    if (!profile) return;

    // Future stages slot in here. The last stage's `completed` arm will send the
    // final formatted output via responder.sendToUser; runPipeline returns void either way.
  });
};
