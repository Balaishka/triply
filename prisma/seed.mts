/**
 * Демо-данные для ручной проверки.
 *
 * Создаёт трёх пользователей, дружбу между ними, поездку с гостем и несколько
 * расходов — включая тот, где доли заданы вручную, и тот, где плательщик сам не
 * участвует. Пароль у всех: `password123`.
 *
 * Запуск: npm run seed
 */
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { loadEnvFile } from "node:process";

// Деление поровну повторено здесь, чтобы скрипт не тянул за собой модули приложения:
// Node резолвит ESM по точным путям, а исходники написаны под сборщик.
function splitEqually(amountMinor: number, memberIds: string[]) {
  const base = Math.floor(amountMinor / memberIds.length);
  const remainder = amountMinor - base * memberIds.length;
  return memberIds.map((memberId, index) => ({
    memberId,
    amountMinor: base + (index < remainder ? 1 : 0),
  }));
}

try {
  loadEnvFile();
} catch {
  // переменные окружения могут прийти снаружи
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const PASSWORD = "password123";
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

async function main() {
  const passwordHash = await hash(PASSWORD, ARGON);

  // Чистим только то, что создаём сами, чтобы seed можно было гонять повторно.
  const emails = ["anna@triply.test", "boris@triply.test", "vera@triply.test"];
  const existing = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = existing.map((user) => user.id);
  if (ids.length > 0) {
    const trips = await prisma.trip.findMany({
      where: { createdById: { in: ids } },
      select: { id: true },
    });
    const tripIds = trips.map((trip) => trip.id);
    await prisma.$transaction([
      prisma.expenseShare.deleteMany({ where: { expense: { tripId: { in: tripIds } } } }),
      prisma.expense.deleteMany({ where: { tripId: { in: tripIds } } }),
      prisma.settlement.deleteMany({ where: { tripId: { in: tripIds } } }),
      prisma.tripMember.deleteMany({ where: { tripId: { in: tripIds } } }),
      prisma.trip.deleteMany({ where: { id: { in: tripIds } } }),
      prisma.friendship.deleteMany({
        where: { OR: [{ requesterId: { in: ids } }, { addresseeId: { in: ids } }] },
      }),
      prisma.session.deleteMany({ where: { userId: { in: ids } } }),
      prisma.user.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }

  const anna = await prisma.user.create({
    data: { email: emails[0], nickname: "anna", passwordHash },
  });
  const boris = await prisma.user.create({
    data: { email: emails[1], nickname: "boris", passwordHash },
  });
  const vera = await prisma.user.create({
    data: { email: emails[2], nickname: "vera", passwordHash },
  });

  await prisma.friendship.createMany({
    data: [
      { requesterId: anna.id, addresseeId: boris.id, status: "ACCEPTED", respondedAt: new Date() },
      { requesterId: anna.id, addresseeId: vera.id, status: "ACCEPTED", respondedAt: new Date() },
      { requesterId: boris.id, addresseeId: vera.id, status: "PENDING" },
    ],
  });

  const trip = await prisma.trip.create({
    data: {
      name: "Грузия в июле",
      currency: "RUB",
      startDate: new Date("2026-07-12T00:00:00.000Z"),
      endDate: new Date("2026-07-19T00:00:00.000Z"),
      createdById: anna.id,
      members: {
        create: [
          { userId: anna.id, addedById: anna.id },
          { userId: boris.id, addedById: anna.id },
          { guestName: "Дима", addedById: anna.id },
        ],
      },
    },
    select: { id: true, members: { select: { id: true, userId: true, guestName: true } } },
  });

  const annaM = trip.members.find((m) => m.userId === anna.id)!.id;
  const borisM = trip.members.find((m) => m.userId === boris.id)!.id;
  const dimaM = trip.members.find((m) => m.guestName === "Дима")!.id;
  const all = [annaM, borisM, dimaM];

  await prisma.expense.create({
    data: {
      tripId: trip.id,
      title: "Квартира на неделю",
      amountMinor: 6_000_00,
      paidByMemberId: annaM,
      spentAt: new Date("2026-07-12T00:00:00.000Z"),
      splitMode: "EQUAL",
      createdById: anna.id,
      shares: { create: splitEqually(6_000_00, all) },
    },
  });

  await prisma.expense.create({
    data: {
      tripId: trip.id,
      title: "Ужин в Тбилиси",
      amountMinor: 4_500_00,
      paidByMemberId: borisM,
      spentAt: new Date("2026-07-13T00:00:00.000Z"),
      splitMode: "EQUAL",
      createdById: boris.id,
      shares: { create: splitEqually(4_500_00, all) },
    },
  });

  // Ручные доли: Дима брал вино, остальные — нет.
  await prisma.expense.create({
    data: {
      tripId: trip.id,
      title: "Винный погреб",
      amountMinor: 3_000_00,
      paidByMemberId: annaM,
      spentAt: new Date("2026-07-15T00:00:00.000Z"),
      splitMode: "MANUAL",
      createdById: anna.id,
      shares: {
        create: [
          { memberId: annaM, amountMinor: 500_00 },
          { memberId: borisM, amountMinor: 500_00 },
          { memberId: dimaM, amountMinor: 2_000_00 },
        ],
      },
    },
  });

  // Плательщик не участвует: Борис оплатил экскурсию, на которую не пошёл.
  await prisma.expense.create({
    data: {
      tripId: trip.id,
      title: "Экскурсия в Казбеги",
      amountMinor: 2_500_00,
      paidByMemberId: borisM,
      spentAt: new Date("2026-07-16T00:00:00.000Z"),
      splitMode: "EQUAL",
      createdById: boris.id,
      shares: { create: splitEqually(2_500_00, [annaM, dimaM]) },
    },
  });

  console.log("Готово. Вход: anna@triply.test / boris@triply.test / vera@triply.test");
  console.log(`Пароль у всех: ${PASSWORD}`);
  console.log(`Поездка: http://localhost:3000/trips/${trip.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
