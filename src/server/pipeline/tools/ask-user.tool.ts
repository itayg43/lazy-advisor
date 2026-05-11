import type { FunctionTool } from "openai/resources/responses/responses";
import { z } from "zod";

import { InternalError } from "#errors";

export type SendToUser = (message: string) => void;
export type WaitForResponse = () => Promise<string>;

export type Responder = {
  sendToUser: SendToUser;
  waitForResponse: WaitForResponse;
};

export const ASK_USER_TOOL: FunctionTool = {
  type: "function",
  name: "ask_user",
  description:
    "Ask the user a clarifying question to better understand their investment goals and preferences.",
  strict: true,
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question to ask the user.",
      },
    },
    required: ["question"],
    additionalProperties: false,
  },
};

const AskUserArgsSchema = z.object({
  question: z.string(),
});

export const handleAskUser = async (
  args: string,
  responder: Responder,
): Promise<string> => {
  let question: string;

  try {
    ({ question } = AskUserArgsSchema.parse(JSON.parse(args)));
  } catch {
    throw new InternalError("Failed to parse ask_user arguments");
  }

  responder.sendToUser(question);

  return responder.waitForResponse();
};
