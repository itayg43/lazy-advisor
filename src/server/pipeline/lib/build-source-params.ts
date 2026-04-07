import type { ResponseInputItem } from "openai/resources/responses/responses";

/**
 * Converts a source (previousResponseId or transcript) into the OpenAI input params
 * used by extraction functions. Shared by all extraction phases.
 *
 * - string → production: chains off a prior response via previous_response_id
 * - array  → evals: passes a full transcript as the input
 */
export const buildSourceParams = (
  source: string | ResponseInputItem[],
): { input: ResponseInputItem[]; previous_response_id?: string } =>
  typeof source === "string"
    ? { input: [], previous_response_id: source }
    : { input: source };
