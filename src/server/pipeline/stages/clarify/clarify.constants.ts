import { KnowledgeLevel, RiskTolerance } from "#schemas/pipeline.schema";

export const RISK_LEVELS = RiskTolerance.options.map((o) => `\`${o}\``).join(", ");
export const KNOWLEDGE_LEVELS = KnowledgeLevel.options.map((o) => `\`${o}\``).join(", ");

export const MAX_FIELDS_TOOL_CALLS = 10;
export const MAX_PREFERENCES_TOOL_CALLS = 5;
