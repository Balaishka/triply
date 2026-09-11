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
  // Миграции ходят мимо пулера. PgBouncer в режиме транзакций раздаёт
  // соединение на каждую транзакцию, а миграции держат advisory-блокировку на
  // всё время работы и меняют схему — им нужно одно и то же соединение от
  // начала до конца. Провайдеры дают для этого отдельный прямой адрес, и тогда
  // он задаётся в DIRECT_DATABASE_URL. На нашем тарифе Timeweb пулера нет, как
  // нет его и локально, — тогда годится обычный DATABASE_URL.
  datasource: { url: process.env.DIRECT_DATABASE_URL?.trim() || env("DATABASE_URL") },
});
