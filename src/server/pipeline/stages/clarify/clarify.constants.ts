import { KnowledgeLevel, RiskTolerance } from "#server/schemas/pipeline.schema";

export const RISK_LEVELS = RiskTolerance.options.map((o) => `\`${o}\``).join(", ");
export const KNOWLEDGE_LEVELS = KnowledgeLevel.options.map((o) => `\`${o}\``).join(", ");

export const MAX_STAGE_TOOL_CALLS = 10;
