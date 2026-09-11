import { describe, expect, it } from "vitest";

import { resolveTestDatabaseUrl } from "./database-url";

const DEV = "postgresql://triply:triply@localhost:5433/triply?schema=public";

describe("адрес тестовой базы", () => {
  it("по умолчанию берёт соседнюю базу с суффиксом", () => {
    expect(resolveTestDatabaseUrl({ DATABASE_URL: DEV })).toBe(
      "postgresql://triply:triply@localhost:5433/triply_test?schema=public",
    );
  });

  it("предпочитает явный TEST_DATABASE_URL", () => {
    const explicit = "postgresql://ci:ci@db:5432/other";
    expect(resolveTestDatabaseUrl({ DATABASE_URL: DEV, TEST_DATABASE_URL: explicit })).toBe(
      explicit,
    );
  });

  it("работает, когда рабочей базы нет вовсе", () => {
    const explicit = "postgresql://ci:ci@db:5432/other";
    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: explicit })).toBe(explicit);
  });

  it("без переменных не выдумывает адрес", () => {
    expect(resolveTestDatabaseUrl({})).toBeNull();
  });

  // Главное, ради чего эта функция отдельная: тесты чистят таблицы целиком.
  it("отказывается работать в базе разработки", () => {
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: DEV, TEST_DATABASE_URL: DEV })).toThrow(
      /совпадает/,
    );
  });

  it("узнаёт ту же базу под другой строкой подключения", () => {
    const same = "postgresql://other:pass@localhost:5433/triply";
    expect(() => resolveTestDatabaseUrl({ DATABASE_URL: DEV, TEST_DATABASE_URL: same })).toThrow(
      /совпадает/,
    );
  });
});
