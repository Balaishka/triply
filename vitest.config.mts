import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Тесты на права работают с настоящим Postgres: база заводится и мигрирует
    // один раз на прогон, а `setup.ts` до загрузки приложения переставляет на
    // неё DATABASE_URL и подменяет то, чего вне запроса Next не существует.
    globalSetup: ["src/test/global-setup.ts"],
    setupFiles: ["src/test/setup.ts"],
    // Тесты действий делят одну базу и чистят её целиком, поэтому файлы идут
    // по очереди: параллельные прогоны стирали бы данные друг друга.
    fileParallelism: false,
  },
  // Тот же алиас, что в tsconfig: иначе модули с импортом «@/…» не собираются
  // под тестами.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
