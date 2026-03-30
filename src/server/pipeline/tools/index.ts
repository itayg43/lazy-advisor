import type { Tool, WebSearchTool } from "openai/resources/responses/responses";

import { ASK_USER_TOOL } from "./ask-user.tool";

export type Stage = "clarify" | "research" | "plan" | "iterate";

const DEFAULT_COUNTRY_CODE = "IL";

const WEB_SEARCH_TOOL: WebSearchTool = {
  type: "web_search",
  search_context_size: "medium",
  user_location: {
    type: "approximate",
    country: DEFAULT_COUNTRY_CODE,
  },
};

const STAGE_TOOLS: Record<Stage, Tool[]> = {
  clarify: [ASK_USER_TOOL],
  research: [WEB_SEARCH_TOOL],
  plan: [],
  iterate: [WEB_SEARCH_TOOL],
};

export const getStageTools = (stage: Stage): Tool[] => STAGE_TOOLS[stage];
