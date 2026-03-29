import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { config } from "#server/config";

const adapter = new PrismaPg({
  connectionString: config.DATABASE_URL,
});

export const prismaClient = new PrismaClient({
  adapter,
});
