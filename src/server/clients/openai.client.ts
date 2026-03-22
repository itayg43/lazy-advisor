import OpenAI from "openai";

import { config } from "#server/config";

export const openaiClient = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});
