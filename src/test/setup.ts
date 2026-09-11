import { loadEnvFile } from "node:process";

import { vi } from "vitest";

import { resolveTestDatabaseUrl } from "./database-url";

/**
 * Подготовка каждого тестового файла.
 *
 * Выполняется до того, как тест импортирует приложение, поэтому здесь и только
 * здесь можно переставить `DATABASE_URL` на тестовую базу: клиент Prisma
 * читает её один раз при загрузке модуля.
 */
try {
  loadEnvFile();
} catch {
  // .env может не быть — в CI переменные приходят снаружи.
}

const testDatabaseUrl = resolveTestDatabaseUrl(process.env);
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;

// Три вещи, которых вне запроса Next не существует. Всё остальное — настоящее:
// и сессия, и права, и база.
vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

vi.mock("next/navigation", async () => {
  const { TestRedirect } = await import("./redirect");
  return {
    redirect: (to: string): never => {
      throw new TestRedirect(to);
    },
  };
});

vi.mock("next/headers", async () => {
  const { testCookies } = await import("./cookies");
  return { cookies: async () => testCookies };
});
