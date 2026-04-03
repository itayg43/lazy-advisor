import type { Tool } from "openai/resources/responses/responses";

import { ASK_USER_TOOL } from "#pipeline/tools/ask-user.tool";

type Stage = "clarify" | "research" | "plan" | "iterate";

const STAGE_TOOLS: Record<Stage, Tool[]> = {
  clarify: [ASK_USER_TOOL],
  research: [],
  plan: [],
  iterate: [],
};

export const getStageTools = (stage: Stage): Tool[] => STAGE_TOOLS[stage];
