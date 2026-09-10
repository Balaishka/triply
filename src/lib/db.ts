import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Клиент Prisma.
 *
 * С 7-й версии подключение задаётся driver adapter'ом, а не строкой в схеме:
 * запросы идут через обычный пул `pg`.
 *
 * В dev Next.js перезагружает модули на каждое изменение файла. Без кеша в
 * `globalThis` это плодило бы новый пул соединений на каждую пересборку, и
 * Postgres быстро упёрся бы в лимит подключений.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Не задан DATABASE_URL — скопируйте .env.example в .env");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
