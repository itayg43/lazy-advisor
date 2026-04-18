import { cleanEnv, str } from "envalid";

export const config = cleanEnv(process.env, {
  OPENAI_API_KEY: str(),
});
