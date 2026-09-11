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

/**
 * Соединений на один экземпляр приложения.
 *
 * Лимит кластера общий на всех, а экземпляров функции Vercel поднимается
 * столько, сколько нужно под нагрузку, и каждый держит свой пул. С пулом по
 * умолчанию (10) хватило бы трёх экземпляров, чтобы разобрать все соединения
 * кластера, и следующий пользователь получил бы отказ в подключении вместо
 * страницы. Три — это запас на несколько экземпляров сразу и место для
 * миграций, которые идут во время сборки.
 */
const POOL_MAX = 3;

/**
 * Сколько соединение ждёт в пуле без дела, прежде чем закрыться. Пул на
 * простаивающем экземпляре не должен занимать общий лимит: трафик у поездок
 * редкий, и большую часть времени соединения никому не нужны.
 */
const POOL_IDLE_MS = 10_000;

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Не задан DATABASE_URL — скопируйте .env.example в .env");
  }
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: POOL_MAX,
      idleTimeoutMillis: POOL_IDLE_MS,
    }),
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
