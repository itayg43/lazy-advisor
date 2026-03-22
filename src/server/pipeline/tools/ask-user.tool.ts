import type { FunctionTool } from "openai/resources/responses/responses";

export type SendToUser = (message: string) => void;
export type WaitForResponse = () => Promise<string>;

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

export const handleAskUser = async (
  args: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<string> => {
  const { question } = JSON.parse(args) as { question: string };
  sendToUser(question);
  return waitForResponse();
};
