import type { Tool } from "openai/resources/responses/responses";

import { ASK_USER_TOOL } from "#pipeline/tools/ask-user.tool";

export const getStageTools = (): Tool[] => [ASK_USER_TOOL];
