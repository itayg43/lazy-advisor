import { StatusCodes } from "http-status-codes";
import { zodTextFormat } from "openai/helpers/zod";
import type {
  ResponseFunctionToolCall,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import type { ReasoningEffort, ResponsesModel } from "openai/resources/shared";
import type { ZodType } from "zod";

import { BaseError, InternalError } from "#errors";
import { createLogger } from "#lib/logger";
import { getStageTools } from "#pipeline/tools";
import {
  ASK_USER_TOOL,
  handleAskUser,
  type SendToUser,
  type WaitForResponse,
} from "#pipeline/tools/ask-user.tool";
import { callOpenAI, callOpenAIParsed, type OpenAIResponse } from "#services/openai";

const logger = createLogger("clarifyPhase");

export class PhaseBudgetExhaustedError extends BaseError {
  constructor(phaseName: string, maxToolCalls: number) {
    super(
      `${phaseName} failed to converge within ${maxToolCalls} tool calls`,
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
}

type PhaseLoopParams = {
  model: ResponsesModel;
  effort: ReasoningEffort;
  instructions: string;
  input: string | ResponseInputItem[];
  maxToolCalls: number;
  phaseName: string;
  sendToUser: SendToUser;
  waitForResponse: WaitForResponse;
};

type PhaseExtractionParams<T> = {
  model: ResponsesModel;
  effort: ReasoningEffort;
  instructions: string;
  lastResponseId: string;
  schema: ZodType<T>;
};

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

export const runPhaseLoop = async ({
  model,
  effort,
  instructions,
  input,
  maxToolCalls,
  phaseName,
  sendToUser,
  waitForResponse,
}: PhaseLoopParams): Promise<{ responseId: string }> => {
  const tools = getStageTools();

  let response = await callOpenAI({
    model,
    instructions,
    input,
    tools,
    reasoning: { effort },
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
      throw new PhaseBudgetExhaustedError(phaseName, maxToolCalls);
    }

    const toolOutputs = await collectToolOutputs(
      functionCalls,
      sendToUser,
      waitForResponse,
    );

    response = await callOpenAI({
      model,
      instructions,
      tools,
      previous_response_id: response.id,
      input: toolOutputs,
      reasoning: { effort },
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

export const runPhaseExtraction = async <T>({
  model,
  effort,
  instructions,
  lastResponseId,
  schema,
}: PhaseExtractionParams<T>): Promise<OpenAIResponse<T>> => {
  return await callOpenAIParsed<T>({
    model,
    instructions,
    input: [],
    previous_response_id: lastResponseId,
    text: { format: zodTextFormat(schema, "output") },
    reasoning: { effort },
  });
};
