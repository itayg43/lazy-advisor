import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { buildSourceParams } from "#pipeline/lib/build-source-params";
import { callOpenAIParsed } from "#services/openai";

export type IntakeResult = { accepted: true; responseId: string } | { accepted: false };

const AcceptanceSchema = z.object({ accepted: z.boolean() });

const ACCEPTANCE_PROMPT = `You are an acceptance classifier. Based on the conversation, determine whether the user is ready to proceed.

Return \`true\` if:
- The user agreed to move forward (e.g. "ok", "sure", "let's do it")
- The user provided their details or answered the agent's clarifying question constructively
- The user resolved the issue the agent raised (e.g. picked a risk level, accepted a revised timeline)

Return \`false\` if the user declined, disengaged, or insisted on their original out-of-scope request without accepting the agent's redirect.`;

export const extractAcceptance = async (responseId: string): Promise<boolean> => {
  const { output } = await callOpenAIParsed<z.infer<typeof AcceptanceSchema>>({
    model: "gpt-5.4-nano",
    instructions: ACCEPTANCE_PROMPT,
    ...buildSourceParams(responseId),
    text: {
      format: zodTextFormat(AcceptanceSchema, "AcceptanceSchema"),
    },
    reasoning: { effort: "low" },
  });

  return output.accepted;
};
