import { afterAll, beforeEach } from "vitest";

import { prisma } from "@/lib/db";

import { clearCookies } from "./cookies";

let tables: string[] | null = null;

/**
 * Список таблиц базы — спрашиваем у самой базы, а не перечисляем руками:
 * иначе новая модель в схеме тихо перестала бы чиститься между тестами.
 */
async function listTables(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    select table_name
    from information_schema.tables
    where table_schema = current_schema()
      and table_type = 'BASE TABLE'
      and table_name <> '_prisma_migrations'
  `;
  return rows.map((row) => `"${row.table_name}"`);
}

/** Пустая база перед каждым тестом: тесты не должны зависеть от порядка. */
export async function resetDatabase(): Promise<void> {
  tables ??= await listTables();
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(`truncate table ${tables.join(", ")} cascade`);
}

/**
 * Подключает тестовую базу к файлу: чистая база и «никто не вошёл» перед каждым
 * тестом, закрытый пул соединений после последнего.
 */
export function setUpTestDatabase(): void {
  beforeEach(async () => {
    clearCookies();
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
}
