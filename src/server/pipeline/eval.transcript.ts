import { InternalError } from "#errors";
import type { Responder } from "#pipeline/tools/ask-user.tool";

export type TranscriptEntry = { role: "agent" | "user"; content: string };

type TrackedResponder = Responder & {
  transcript: TranscriptEntry[];
};

/**
 * A `Responder` that records the conversation into `transcript` as it runs, so a
 * finished eval can assert on the dialogue and write it to the last-run artifact.
 * `sendToUser` captures the model's message; `waitForResponse` returns the next
 * scripted response in order (throwing if the script is exhausted) and captures it.
 */
export const createTrackedResponder = (responses: string[]): TrackedResponder => {
  // The handlers under test (askWithClassify, runConversation, the runPhaseLoop
  // handlers, plain sends) drive these two methods in real conversation order,
  // so recording each call as it lands yields a chronological `transcript`. The
  // methods are NOT a 1:1 pair: a handler may send several messages before it
  // waits (a clarification re-ask) or send with no wait at all (education /
  // transition text). `responseIndex` therefore advances only on waits, not
  // sends — it tracks how many scripted replies the conversation has consumed.
  let responseIndex = 0;
  const transcript: TranscriptEntry[] = [];

  return {
    // Any outbound message — question, re-ask, or info text — recorded as an
    // agent entry. A send does not imply a reply is coming.
    sendToUser: (message: string) => {
      transcript.push({ role: "agent", content: message });
    },
    // A handler blocked for input: hand back the next scripted reply, advance
    // the cursor, and record it as a user entry. A real Responder awaits live
    // input here, so we return a Promise to honor that async contract even
    // though we resolve synchronously. Running past the script means the
    // handler asked more than the case scripted answers for — a bug in the
    // case, so we throw rather than hang or return undefined.
    waitForResponse: () => {
      if (responseIndex >= responses.length)
        throw new InternalError(
          `createTrackedResponder: no response scripted for turn ${responseIndex + 1} (only ${responses.length} provided)`,
        );

      const response = responses[responseIndex];
      responseIndex++;
      transcript.push({ role: "user", content: response });

      return Promise.resolve(response);
    },
    transcript,
  };
};
