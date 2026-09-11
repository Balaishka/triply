import { beforeEach, describe, expect, it } from "vitest";

import { markTransferPaidAction, unmarkTransferAction } from "@/lib/actions/settlements";
import { prisma } from "@/lib/db";
import { MAX_AMOUNT_MINOR } from "@/lib/settlement";
import { setUpTestDatabase } from "@/test/db";
import {
  createTrip,
  createUser,
  signIn,
  signOut,
  type TestTrip,
  type TestUser,
} from "@/test/factories";
import { expectRedirect } from "@/test/redirect";

/**
 * Отметки о переводах.
 *
 * Отличаются от расходов одним: работают и в завершённой поездке. Ради них её
 * чаще всего и открывают после возвращения, поэтому запрет на запись сюда не
 * распространяется — и это тоже правило, а не недосмотр.
 */
setUpTestDatabase();

let anna: TestUser;
let boris: TestUser;
let outsider: TestUser;
let trip: TestTrip;

beforeEach(async () => {
  anna = await createUser("anna");
  boris = await createUser("boris");
  outsider = await createUser("outsider");
  trip = await createTrip({ createdBy: anna, members: [boris] });
  await signIn(anna);
});

function markOwn(): Promise<string> {
  return prisma.settlement
    .create({
      data: {
        tripId: trip.id,
        fromMemberId: trip.members.boris,
        toMemberId: trip.members.anna,
        amountMinor: 500,
        markedById: anna.id,
      },
      select: { id: true },
    })
    .then((settlement) => settlement.id);
}

describe("посторонний", () => {
  beforeEach(async () => {
    await signIn(outsider);
  });

  it("не отмечает перевод в чужой поездке", async () => {
    const state = await markTransferPaidAction(
      trip.id,
      trip.members.boris,
      trip.members.anna,
      500,
    );

    expect(state).toEqual({ error: "Поездка не найдена" });
    expect(await prisma.settlement.count()).toBe(0);
  });

  it("не снимает чужую отметку", async () => {
    const settlementId = await markOwn();

    expect(await unmarkTransferAction(trip.id, settlementId)).toEqual({
      error: "Поездка не найдена",
    });
    expect(await prisma.settlement.count()).toBe(1);
  });
});

describe("не вошедший", () => {
  it("уходит на вход", async () => {
    signOut();

    expect(
      await expectRedirect(
        markTransferPaidAction(trip.id, trip.members.boris, trip.members.anna, 500),
      ),
    ).toBe("/login");
    expect(await prisma.settlement.count()).toBe(0);
  });
});

describe("завершённая поездка", () => {
  beforeEach(async () => {
    await prisma.trip.update({
      where: { id: trip.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  });

  it("всё ещё принимает отметки — ради них её и открывают", async () => {
    expect(
      await markTransferPaidAction(trip.id, trip.members.boris, trip.members.anna, 500),
    ).toBeNull();

    const saved = await prisma.settlement.findFirstOrThrow({
      select: { fromMemberId: true, toMemberId: true, amountMinor: true, markedById: true },
    });
    expect(saved).toEqual({
      fromMemberId: trip.members.boris,
      toMemberId: trip.members.anna,
      amountMinor: 500,
      markedById: anna.id,
    });
  });

  it("и позволяет отменить ошибочную", async () => {
    const settlementId = await markOwn();

    expect(await unmarkTransferAction(trip.id, settlementId)).toBeNull();
    expect(await prisma.settlement.count()).toBe(0);
  });
});

describe("проверка перевода", () => {
  it("не принимает участника из другой поездки", async () => {
    const other = await createTrip({ createdBy: outsider });

    expect(
      await markTransferPaidAction(trip.id, trip.members.boris, other.members.outsider, 500),
    ).toEqual({ error: "Участник не найден" });
    expect(await prisma.settlement.count()).toBe(0);
  });

  it("не принимает перевод самому себе", async () => {
    expect(
      await markTransferPaidAction(trip.id, trip.members.anna, trip.members.anna, 500),
    ).toEqual({ error: "Перевод самому себе ничего не меняет" });
  });

  // Сумма приходит числом из запроса, минуя zod, поэтому проверяется здесь.
  it.each([
    ["ноль", 0],
    ["отрицательную", -500],
    ["дробную", 10.5],
    ["больше предела", MAX_AMOUNT_MINOR + 1],
    ["не число", Number.NaN],
  ])("не принимает %s сумму", async (_name, amountMinor) => {
    expect(
      await markTransferPaidAction(trip.id, trip.members.boris, trip.members.anna, amountMinor),
    ).toEqual({ error: "Неверная сумма перевода" });
    expect(await prisma.settlement.count()).toBe(0);
  });
});

describe("участник поездки", () => {
  it("отмечает перевод между другими участниками", async () => {
    const dima = await createUser("dima");
    trip = await createTrip({ createdBy: anna, members: [boris, dima] });
    await signIn(boris);

    expect(
      await markTransferPaidAction(trip.id, trip.members.dima, trip.members.anna, 700),
    ).toBeNull();

    const saved = await prisma.settlement.findFirstOrThrow({ select: { markedById: true } });
    expect(saved.markedById).toBe(boris.id);
  });

  it("не снимает отметку из другой поездки по её идентификатору", async () => {
    const other = await createTrip({ createdBy: anna, members: [boris] });
    const alien = await prisma.settlement.create({
      data: {
        tripId: other.id,
        fromMemberId: other.members.boris,
        toMemberId: other.members.anna,
        amountMinor: 300,
        markedById: anna.id,
      },
      select: { id: true },
    });

    expect(await unmarkTransferAction(trip.id, alien.id)).toEqual({ error: "Отметка не найдена" });
    expect(await prisma.settlement.count({ where: { id: alien.id } })).toBe(1);
  });
});
