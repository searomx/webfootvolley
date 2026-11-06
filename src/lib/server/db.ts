import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { requiredSetting } from "./config";

const globalDb = globalThis as typeof globalThis & { footvolleyDb?: PrismaClient };

export function getDb() {
  if (!globalDb.footvolleyDb) {
    const adapter = new PrismaPg({
      connectionString: requiredSetting("DATABASE_URL"),
      max: 5,
      connectionTimeoutMillis: 5000,
    });
    globalDb.footvolleyDb = new PrismaClient({ adapter });
  }
  return globalDb.footvolleyDb;
}
