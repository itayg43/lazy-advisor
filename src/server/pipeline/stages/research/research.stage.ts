import { zodTextFormat } from "openai/helpers/zod";

import { createLogger } from "#server/lib/logger";
import { buildProfileSummary } from "#server/pipeline/lib";
import { getStageTools } from "#server/pipeline/tools";
import { ResearchSummarySchema } from "#server/schemas/pipeline.schema";
import { callOpenAI, callOpenAIParsed } from "#server/services/openai";
import type { ResearchSummary, UserProfile } from "#server/types/pipeline.types";

const logger = createLogger("researchStage");

const RESEARCH_MODEL = "gpt-5.4-mini";
const EXTRACTION_MODEL = "gpt-5.4-nano";

const RESEARCH_SYSTEM_PROMPT = `# Role and Objective
You are a financial researcher. Your job is to search the web for current, accurate data that will later be used to build an investment plan. Do not create a plan — only gather and synthesize data.

# Instructions
- Run 2–3 diverse search queries to cover different aspects of the user's profile.
- Prefer authoritative sources: fund provider pages (Vanguard, iShares, SPDR), regulatory sites, well-known financial publications.
- Focus on current-year data. Avoid outdated expense ratios or discontinued products.

# What to Research
- **ETFs**: ticker, full name, expense ratio, domicile, accumulating vs distributing, currency, index tracked.
- **Brokerages**: skip if the user already has one. Otherwise, recommend options available in their location.
- **Allocation strategies**: age-appropriate stock/bond split, geographic diversification.
- **Tax efficiency**: relevant tax treaties, withholding rates, tax-advantaged account types.

# Location-Specific Guidance — Israel
- Prefer Irish-domiciled accumulating ETFs (UCITS) — 15% withholding via Ireland-US tax treaty vs 25% for US-domiciled.
- Mention קרנות מחקות (index-tracking mutual funds) as a local alternative with tax advantages.
- Brokerages: Meitav, IBI, Interactive Brokers Israel.
- Capital gains tax: 25% on foreign ETFs, potential tax advantages for Israeli mutual funds.

# Output Format
Write flowing paragraphs covering:
- Each recommended ETF with its ticker, full name, expense ratio, reasoning, risks, and a source URL.
- Brokerage recommendation (if applicable).
- Allocation rationale with suggested percentages.
Do not use markdown headers. Write naturally as a research summary.`;

const EXTRACTION_SYSTEM_PROMPT = `# Role and Objective
You are the extraction stage of an investment research pipeline. Your sole responsibility is to extract a structured ResearchSummary from the preceding research text. Do not add information that was not found in the research.

# Field Rules
- **expenseRatio**: number-only string without the % symbol (e.g., "0.22" not "0.22%").
- **sourceUrl**: must be a real URL from the research. Do not fabricate URLs.
- **reasoning** and **risks**: stay close to the research text. Do not embellish or add new analysis.

# Instructions
- Extract all ETFs mentioned in the research with their full details.
- Extract the brokerage recommendation and allocation rationale as written.
- If a field is unclear in the research, use the closest available information rather than inventing data.`;

export const runResearchStage = async (
  profile: UserProfile,
): Promise<ResearchSummary> => {
  logger.info("Starting research stage", { profile });

  const tools = getStageTools("research");
  const profileSummary = buildProfileSummary(profile);

  const researchResponse = await callOpenAI({
    model: RESEARCH_MODEL,
    instructions: RESEARCH_SYSTEM_PROMPT,
    input: profileSummary,
    tools,
  });

  logger.info("Research phase complete", {
    responseId: researchResponse.id,
    usage: researchResponse.usage,
  });
  logger.debug("Research phase output", {
    output: researchResponse.output,
  });

  const extractionResponse = await callOpenAIParsed<ResearchSummary>({
    model: EXTRACTION_MODEL,
    instructions: EXTRACTION_SYSTEM_PROMPT,
    input: [],
    previous_response_id: researchResponse.id,
    text: {
      format: zodTextFormat(ResearchSummarySchema, "ResearchSummarySchema"),
    },
  });

  logger.info("Extraction phase complete", {
    responseId: extractionResponse.id,
    usage: extractionResponse.usage,
    etfCount: extractionResponse.output.recommendedEtfs.length,
  });
  logger.debug("Extraction phase output", {
    output: extractionResponse.output,
  });

  return extractionResponse.output;
};
