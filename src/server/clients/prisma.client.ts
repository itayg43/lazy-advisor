import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { config } from "#config";

const adapter = new PrismaPg({
  connectionString: config.DATABASE_URL,
});

export const prismaClient = new PrismaClient({
  adapter,
});
