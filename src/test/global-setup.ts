import { execFileSync } from "node:child_process";
import { loadEnvFile } from "node:process";

import { Client } from "pg";

import { resolveTestDatabaseUrl } from "./database-url";

/**
 * Подготовка тестовой базы: один раз на весь прогон.
 *
 * База заводится сама и накатывает те же миграции, что и рабочая: тест на права
 * должен спотыкаться о настоящие внешние ключи и ограничения, а не о их
 * пересказ. Если Postgres не поднят, прогон падает с указанием, что запустить —
 * молча пропущенные тесты на права хуже, чем их отсутствие: о них помнят, а
 * проверяют они ничего.
 */
export default async function setup(): Promise<void> {
  try {
    loadEnvFile();
  } catch {
    // .env может не быть — в CI переменные приходят снаружи.
  }

  const url = resolveTestDatabaseUrl(process.env);
  if (!url) {
    throw new Error(
      "Не задан ни TEST_DATABASE_URL, ни DATABASE_URL — скопируйте .env.example в .env",
    );
  }

  await createDatabaseIfMissing(url);

  // Миграции гоняем прямо файлом CLI: так не нужен ни npx, ни его .cmd-обёртка
  // под Windows. Адрес передаём переменной окружения — в prisma.config.ts
  // .env грузится так, что внешнее значение остаётся сильнее.
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: ["ignore", "ignore", "inherit"],
  });
}

/**
 * Заводит базу, если её ещё нет.
 *
 * `CREATE DATABASE` нельзя выполнить, уже находясь в создаваемой базе, поэтому
 * подключаемся к служебной `postgres` на том же сервере.
 */
async function createDatabaseIfMissing(connectionString: string): Promise<void> {
  const url = new URL(connectionString);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));

  const admin = new URL(connectionString);
  admin.pathname = "/postgres";
  admin.search = "";

  const client = new Client({ connectionString: admin.toString() });

  try {
    await client.connect();
  } catch (cause) {
    throw new Error(
      `Postgres на ${url.host} недоступен. Тесты на права работают с настоящей базой — ` +
        "поднимите её: docker compose up -d db",
      { cause },
    );
  }

  try {
    const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (rowCount === 0) {
      // Имя базы — не параметр запроса, его приходится вставлять в текст;
      // экранируем кавычками, как это делает сам Postgres.
      await client.query(`create database "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }
}
