import { runWithSession } from "#lib/session-context";
import { runClarifyOrTerminate } from "#pipeline/stages/clarify/clarify.orchestrator";
import type { SendToUser, WaitForResponse } from "#pipeline/tools/ask-user.tool";

export const runPipeline = async (
  sessionId: string,
  goal: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<void> => {
  return runWithSession(sessionId, async () => {
    const profile = await runClarifyOrTerminate(goal, sendToUser, waitForResponse);
    if (!profile) return;

    // Future stages slot in here. The last stage's `completed` arm will send the
    // final formatted output via sendToUser; runPipeline returns void either way.
  });
};
