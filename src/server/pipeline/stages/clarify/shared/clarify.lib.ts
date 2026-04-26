import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";

import { InternalError } from "#errors";
import { createLogger } from "#lib/logger";
import { type PhaseSourceParams } from "#pipeline/lib/build-source-params";
import { getStageTools } from "#pipeline/tools";
import {
  ASK_USER_TOOL,
  handleAskUser,
  type SendToUser,
  type WaitForResponse,
} from "#pipeline/tools/ask-user.tool";
import { callOpenAI } from "#services/openai";

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

// Runs the tool-call loop for a clarify phase. Enforces: model gpt-5.4-nano,
// reasoning effort low, clarify tools. Returns the final response ID.
export const runPhaseLoop = async (
  instructions: string,
  initialParams: PhaseSourceParams,
  maxToolCalls: number,
  phaseName: string,
  sendToUser: SendToUser,
  waitForResponse: WaitForResponse,
): Promise<{ responseId: string }> => {
  const tools = getStageTools();

  let response = await callOpenAI({
    model: "gpt-5.4-nano",
    instructions,
    ...initialParams,
    tools,
    reasoning: { effort: "low" },
  });

  logger.info(`${phaseName} initial response`, {
    responseId: response.id,
    usage: response.usage,
  });
  logger.debug(`${phaseName} initial response output`, { output: response.output });

  let toolCallCount = 0;

  // Loop exits on break (model stops calling tools) or throw (tool call cap exceeded)
  while (true) {
    const functionCalls = response.output.filter(
      (item): item is ResponseFunctionToolCall => item.type === "function_call",
    );

    if (functionCalls.length === 0) break;

    toolCallCount += functionCalls.length;
    if (toolCallCount > maxToolCalls) {
      throw new InternalError(
        `${phaseName} failed to converge within ${maxToolCalls} tool calls`,
      );
    }

    const toolOutputs = await collectToolOutputs(
      functionCalls,
      sendToUser,
      waitForResponse,
    );

    response = await callOpenAI({
      model: "gpt-5.4-nano",
      instructions,
      tools,
      previous_response_id: response.id,
      input: toolOutputs,
      reasoning: { effort: "low" },
    });

    logger.info(`${phaseName} follow-up response`, {
      responseId: response.id,
      usage: response.usage,
    });
    logger.debug(`${phaseName} follow-up response output`, { output: response.output });
  }

  logger.info(`${phaseName} complete`, {
    lastResponseId: response.id,
    totalToolCalls: toolCallCount,
  });

  return { responseId: response.id };
};
