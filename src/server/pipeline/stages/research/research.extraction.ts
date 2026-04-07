import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputItem } from "openai/resources/responses/responses";

import { createLogger } from "#lib/logger";
import { buildSourceParams } from "#pipeline/lib/build-source-params";
import { ResearchSummarySchema } from "#schemas/pipeline.schema";
import { callOpenAIParsed } from "#services/openai";
import type { ResearchSummary } from "#types/pipeline.types";

const logger = createLogger("researchExtraction");

const EXTRACTION_SYSTEM_PROMPT = `# Role and Objective
You are the extraction phase of an investment advisor pipeline. Your sole responsibility is to extract a structured ResearchSummary from research text about ETFs and investment products. Do **not** infer, assume, or add information that was not present in the research text.

# Instructions
- Group products by their allocation category (e.g., "U.S. equities (S&P 500)", "קרן כספית").
- For each product, extract all available fields from the research text.
- If a field is not mentioned for a product, use the specified default.

# Field Rules
- **allocationCategory**: the asset class or category this fund belongs to, as described in the research text.
- **percentage**: the allocation percentage for this category, taken from the allocation plan that preceded the research. Each category in the allocation plan corresponds to a category in the research — use the percentage from the matching allocation plan slice.
- **ticker**: the stock exchange ticker symbol (e.g., "CSPX", "SPY", "5122505").
- **name**: the full fund name as stated in the research text.
- **expenseRatio**: annual management fee as a decimal percentage (e.g., 0.07 for 0.07%). Extract the numeric value only.
- **trackingIndex**: the benchmark index the fund tracks (e.g., "S&P 500", "MSCI World"). Default to \`"none"\` if not stated.
- **sourceUrl**: the URL from which this information was sourced. Extract from url_citation annotations or URLs mentioned inline in the research text.`;

export const extractResearchSummary = async (
  // string = previousResponseId (production); array = full transcript (evals)
  source: string | ResponseInputItem[],
): Promise<ResearchSummary> => {
  const { id, usage, output } = await callOpenAIParsed<ResearchSummary>({
    model: "gpt-5.4-nano",
    instructions: EXTRACTION_SYSTEM_PROMPT,
    ...buildSourceParams(source),
    text: {
      format: zodTextFormat(ResearchSummarySchema, "ResearchSummarySchema"),
    },
    reasoning: {
      effort: "low",
    },
  });

  logger.info("Extraction complete", {
    responseId: id,
    usage,
  });
  logger.debug("Extracted research summary", {
    summary: output,
  });

  return output;
};
