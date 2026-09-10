import { loadEnvFile } from "node:process";

import { defineConfig, env } from "prisma/config";

/**
 * Конфигурация Prisma CLI (миграции, интроспекция).
 *
 * С Prisma 7 строка подключения живёт здесь, а не в `schema.prisma`: сама схема
 * больше не знает про окружение. Заодно .env приходится подгружать вручную —
 * автоматической загрузки в 7-й версии больше нет.
 */
try {
  loadEnvFile();
} catch {
  // .env может не быть — тогда рассчитываем на переменные окружения снаружи.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
