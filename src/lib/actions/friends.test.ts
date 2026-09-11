import { beforeEach, describe, expect, it } from "vitest";

import {
  acceptFriendRequestAction,
  removeFriendshipAction,
  sendFriendRequestAction,
} from "@/lib/actions/friends";
import { prisma } from "@/lib/db";
import { setUpTestDatabase } from "@/test/db";
import {
  createExpense,
  createTrip,
  createUser,
  equalShares,
  makeFriends,
  signIn,
  type TestUser,
} from "@/test/factories";

/**
 * Дружба — это согласие, на котором держится право добавлять в поездку.
 *
 * Поэтому заявку нельзя ни принять за другого, ни удалить чужую: иначе правило
 * «в поездку добавляют только подтверждённого друга» обходится на шаг раньше.
 */
setUpTestDatabase();

let anna: TestUser;
let boris: TestUser;
let outsider: TestUser;

beforeEach(async () => {
  anna = await createUser("anna");
  boris = await createUser("boris");
  outsider = await createUser("outsider");
});

describe("заявка в друзья", () => {
  it("не отправляется самому себе", async () => {
    await signIn(anna);

    expect(await sendFriendRequestAction(anna.id)).toEqual({
      error: "Нельзя добавить в друзья самого себя",
    });
    expect(await prisma.friendship.count()).toBe(0);
  });

  // Иначе об одной дружбе было бы две записи и стало бы непонятно, какую
  // удалять при разрыве.
  it("на встречную превращается в дружбу, а не во вторую запись", async () => {
    await signIn(anna);
    expect(await sendFriendRequestAction(boris.id)).toBeNull();

    await signIn(boris);
    expect(await sendFriendRequestAction(anna.id)).toBeNull();

    const friendships = await prisma.friendship.findMany({ select: { status: true } });
    expect(friendships).toEqual([{ status: "ACCEPTED" }]);
  });

  it("принимается только адресатом", async () => {
    await signIn(anna);
    await sendFriendRequestAction(boris.id);
    const { id } = await prisma.friendship.findFirstOrThrow({ select: { id: true } });

    // Ни отправитель, ни посторонний с идентификатором заявки.
    expect(await acceptFriendRequestAction(id)).toEqual({ error: "Заявка не найдена" });
    await signIn(outsider);
    expect(await acceptFriendRequestAction(id)).toEqual({ error: "Заявка не найдена" });

    const saved = await prisma.friendship.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    expect(saved.status).toBe("PENDING");

    await signIn(boris);
    expect(await acceptFriendRequestAction(id)).toBeNull();
  });

  it("не удаляется посторонним", async () => {
    await makeFriends(anna, boris);
    const { id } = await prisma.friendship.findFirstOrThrow({ select: { id: true } });

    await signIn(outsider);
    expect(await removeFriendshipAction(id)).toEqual({ error: "Не найдено" });
    expect(await prisma.friendship.count()).toBe(1);
  });
});

describe("разрыв дружбы", () => {
  // Убрать человека из поездки задним числом значило бы разрушить уже
  // посчитанные долги.
  it("не трогает общие поездки и расходы", async () => {
    await makeFriends(anna, boris);
    const trip = await createTrip({ createdBy: anna, members: [boris] });
    await createExpense({
      tripId: trip.id,
      createdBy: anna,
      paidByMemberId: trip.members.anna,
      amountMinor: 1000,
      shares: equalShares(1000, [trip.members.anna, trip.members.boris]),
    });
    const { id } = await prisma.friendship.findFirstOrThrow({ select: { id: true } });

    await signIn(anna);
    expect(await removeFriendshipAction(id)).toBeNull();

    expect(await prisma.friendship.count()).toBe(0);
    expect(await prisma.tripMember.count({ where: { tripId: trip.id } })).toBe(2);
    expect(await prisma.expenseShare.count()).toBe(2);
  });
});
