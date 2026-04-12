import type { ResponseInputItem } from "openai/resources/responses/responses";

// OpenAI call params derived from a phase source. Accepted by runPhaseLoop as the
// initial call params, and produced by buildSourceParams for eval/production use.
export type PhaseSourceParams = {
  input: string | ResponseInputItem[];
  previous_response_id?: string;
};

/**
 * Converts a source (previousResponseId or transcript) into OpenAI input params.
 * Used by pipeline phases (fields, preferences, extraction).
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
