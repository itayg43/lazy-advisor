import { cleanEnv, str, url } from "envalid";

export const config = cleanEnv(process.env, {
  DATABASE_URL: url(),

  REDIS_URL: url(),

  OPENAI_API_KEY: str(),
});
