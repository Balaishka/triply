/**
 * Адрес базы для тестов.
 *
 * Тесты на права работают с настоящим Postgres: проверка «чужую поездку не
 * тронуть» держится на запросах, и подменённый клиент проверял бы мок, а не
 * правило. Между тестами таблицы чистятся целиком, поэтому база разработки не
 * годится — по умолчанию берём соседнюю, с суффиксом `_test` на том же
 * сервере. `TEST_DATABASE_URL` перекрывает выбор: в CI база приезжает своя.
 */

const SUFFIX = "_test";

/** Достаточно того, что умеет `process.env`: чтение строк по имени. */
export type TestDatabaseEnv = Readonly<Record<string, string | undefined>>;

/**
 * Возвращает адрес тестовой базы или `null`, если взять его неоткуда.
 *
 * Совпадение с рабочей базой — это ошибка, а не повод продолжить: следующим
 * шагом тест очистил бы таблицы разработчика.
 */
export function resolveTestDatabaseUrl(env: TestDatabaseEnv): string | null {
  const base = env.DATABASE_URL?.trim() || undefined;
  const explicit = env.TEST_DATABASE_URL?.trim() || undefined;

  const url = explicit ?? (base ? withSuffix(base) : undefined);
  if (!url) return null;

  if (base && sameDatabase(url, base)) {
    throw new Error(
      "TEST_DATABASE_URL совпадает с DATABASE_URL. Тесты очищают таблицы — " +
        "укажите отдельную базу.",
    );
  }

  return url;
}

/** Тот же сервер и те же параметры, но база с суффиксом. */
function withSuffix(connectionString: string): string {
  const url = new URL(connectionString);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) {
    throw new Error(`В DATABASE_URL не указана база: ${connectionString}`);
  }
  url.pathname = `/${encodeURIComponent(name + SUFFIX)}`;
  return url.toString();
}

/** Одна и та же база — это совпадение хоста, порта и имени, а не строк. */
function sameDatabase(a: string, b: string): boolean {
  const left = new URL(a);
  const right = new URL(b);
  return (
    left.host === right.host &&
    decodeURIComponent(left.pathname) === decodeURIComponent(right.pathname)
  );
}
