import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";

import { InternalError } from "#errors";
import { createLogger } from "#lib/logger";
import { type TranscriptEntry } from "#pipeline/eval.transcript";
import {
  ASK_USER_TOOL,
  handleAskUser,
  type SendToUser,
  type WaitForResponse,
} from "#pipeline/tools/ask-user.tool";

const logger = createLogger("clarifyLib");

export const collectToolOutputs = async (
  functionCalls: ResponseFunctionToolCall[],
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<ResponseInputItem.FunctionCallOutput[]> => {
  const toolOutputs: ResponseInputItem.FunctionCallOutput[] = [];

  for (const functionCall of functionCalls) {
    if (functionCall.name !== ASK_USER_TOOL.name) {
      throw new InternalError(`Unexpected tool call: ${functionCall.name}`);
    }

    logger.info("Tool call received", {
      tool: functionCall.name,
      callId: functionCall.call_id,
    });
    logger.debug("Tool call arguments", {
      arguments: functionCall.arguments,
    });

    const result = await handleAskUser(
      functionCall.arguments,
      sendToUser,
      waitForResponse,
    );

    logger.info("Tool call completed", {
      tool: functionCall.name,
      callId: functionCall.call_id,
    });
    logger.debug("User response", {
      userResponse: result,
    });

    toolOutputs.push({
      type: "function_call_output",
      call_id: functionCall.call_id,
      output: result,
    });
  }

  return toolOutputs;
};

// Converts a ResponseInputItem[] to TranscriptEntry[] for eval last-run files.
// Includes the initial user message, agent questions, and user responses.
export const toTranscriptEntries = (items: ResponseInputItem[]): TranscriptEntry[] =>
  items.flatMap((item): TranscriptEntry[] => {
    if ("role" in item && item.role === "user" && typeof item.content === "string") {
      return [{ role: "user", content: item.content }];
    }
    if (
      "type" in item &&
      item.type === "function_call" &&
      "name" in item &&
      item.name === "ask_user"
    ) {
      const args = JSON.parse(item.arguments) as { question: string };

      return [{ role: "agent", content: args.question }];
    }
    if ("type" in item && item.type === "function_call_output") {
      return [
        {
          role: "user",
          content:
            typeof item.output === "string" ? item.output : JSON.stringify(item.output),
        },
      ];
    }

    return [];
  });
