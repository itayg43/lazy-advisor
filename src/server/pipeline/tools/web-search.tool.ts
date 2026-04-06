import type { WebSearchTool } from "openai/resources/responses/responses";

const ALLOWED_DOMAINS = [
  "tase.co.il",
  "bizportal.co.il",
  "funder.co.il",
  "globes.co.il",
  "themarker.com",
  "lazyinvestor.co.il",
  "moneyplan.co.il",
  "hasolidit.com",
];

export const WEB_SEARCH_TOOL: WebSearchTool = {
  type: "web_search_2025_08_26",
  user_location: { country: "IL" },
  filters: { allowed_domains: ALLOWED_DOMAINS },
  search_context_size: "medium",
};
