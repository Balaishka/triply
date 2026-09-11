import { beforeEach, describe, expect, it } from "vitest";

import {
  addFriendToTripAction,
  addGuestToTripAction,
  completeTripAction,
  createTripAction,
  deleteTripAction,
  linkGuestToUserAction,
  removeTripMemberAction,
  reopenTripAction,
  updateTripAction,
} from "@/lib/actions/trips";
import { prisma } from "@/lib/db";
import { setUpTestDatabase } from "@/test/db";
import {
  createExpense,
  createTrip,
  createUser,
  equalShares,
  makeFriends,
  signIn,
  signOut,
  type TestTrip,
  type TestUser,
  tripForm,
} from "@/test/factories";
import { expectRedirect } from "@/test/redirect";

/**
 * Права на поездку — на сервере.
 *
 * Интерфейс прячет кнопки, но запрос можно отправить и без него, поэтому
 * проверяется не «кнопки нет», а «действие отказало и в базе ничего не
 * изменилось».
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
  await makeFriends(anna, boris);
  trip = await createTrip({ createdBy: anna, members: [boris] });
});

function guestForm(guestName: string): FormData {
  const form = new FormData();
  form.set("guestName", guestName);
  return form;
}

describe("посторонний", () => {
  beforeEach(async () => {
    await signIn(outsider);
  });

  // «Не найдена», а не «нет доступа»: по разнице ответов было бы видно, какие
  // поездки существуют.
  it("не редактирует поездку", async () => {
    const state = await updateTripAction(trip.id, null, tripForm({ name: "Переименовал" }));

    expect(state).toEqual({ error: "Поездка не найдена" });
    const saved = await prisma.trip.findUnique({ where: { id: trip.id }, select: { name: true } });
    expect(saved?.name).toBe("Поездка");
  });

  it("не добавляет в неё участников", async () => {
    const state = await addGuestToTripAction(trip.id, null, guestForm("Гость"));

    expect(state).toEqual({ error: "Поездка не найдена" });
    expect(await prisma.tripMember.count({ where: { tripId: trip.id } })).toBe(2);
  });

  it("не убирает из неё участников", async () => {
    const state = await removeTripMemberAction(trip.id, trip.members.boris);

    expect(state).toEqual({ error: "Поездка не найдена" });
    expect(await prisma.tripMember.count({ where: { tripId: trip.id } })).toBe(2);
  });

  it("не завершает и не переоткрывает поездку", async () => {
    expect(await completeTripAction(trip.id)).toEqual({ error: "Поездка не найдена" });
    expect(await reopenTripAction(trip.id)).toEqual({ error: "Поездка не найдена" });

    const saved = await prisma.trip.findUnique({ where: { id: trip.id }, select: { status: true } });
    expect(saved?.status).toBe("ACTIVE");
  });

  it("не удаляет поездку", async () => {
    const state = await deleteTripAction(trip.id);

    expect(state).toEqual({ error: "Удалить поездку может только тот, кто её создал" });
    expect(await prisma.trip.count({ where: { id: trip.id } })).toBe(1);
  });
});

describe("не вошедший", () => {
  it("уходит на вход, а не получает отказ", async () => {
    signOut();

    expect(await expectRedirect(updateTripAction(trip.id, null, tripForm({})))).toBe("/login");
    expect(await expectRedirect(createTripAction(null, tripForm({})))).toBe("/login");
    expect(await prisma.trip.count()).toBe(1);
  });
});

describe("завершённая поездка", () => {
  const closed = "Поездка завершена — сначала откройте её заново";

  beforeEach(async () => {
    await signIn(anna);
    await prisma.trip.update({
      where: { id: trip.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  });

  it("закрыта на запись даже для своих", async () => {
    expect(await updateTripAction(trip.id, null, tripForm({ name: "Новое" }))).toEqual({
      error: closed,
    });
    expect(await addGuestToTripAction(trip.id, null, guestForm("Гость"))).toEqual({ error: closed });
    expect(await removeTripMemberAction(trip.id, trip.members.boris)).toEqual({ error: closed });

    expect(await prisma.tripMember.count({ where: { tripId: trip.id } })).toBe(2);
  });

  it("но переоткрывается участником", async () => {
    expect(await reopenTripAction(trip.id)).toBeNull();

    const saved = await prisma.trip.findUnique({
      where: { id: trip.id },
      select: { status: true, completedAt: true },
    });
    expect(saved).toEqual({ status: "ACTIVE", completedAt: null });
  });
});

describe("состав участников", () => {
  beforeEach(async () => {
    await signIn(anna);
  });

  it("пополняется только своими друзьями", async () => {
    const state = await addFriendToTripAction(trip.id, outsider.id);

    expect(state).toEqual({ error: "Добавить в поездку можно только своего друга" });
    expect(await prisma.tripMember.count({ where: { tripId: trip.id } })).toBe(2);
  });

  it("не считает другом того, чья заявка ещё висит", async () => {
    const dima = await createUser("dima");
    await prisma.friendship.create({ data: { requesterId: anna.id, addresseeId: dima.id } });

    expect(await addFriendToTripAction(trip.id, dima.id)).toEqual({
      error: "Добавить в поездку можно только своего друга",
    });
  });

  it("принимает подтверждённого друга", async () => {
    const dima = await createUser("dima");
    await makeFriends(dima, anna);

    expect(await addFriendToTripAction(trip.id, dima.id)).toBeNull();
    expect(await prisma.tripMember.count({ where: { tripId: trip.id, userId: dima.id } })).toBe(1);
  });

  it("не держит создателя поездки", async () => {
    const state = await removeTripMemberAction(trip.id, trip.members.anna);

    expect(state).toEqual({ error: "Создателя поездки убрать нельзя" });
  });

  // Иначе из расчёта пропали бы доли и суммы перестали бы сходиться.
  it("не отпускает того, кто числится в расходах", async () => {
    await createExpense({
      tripId: trip.id,
      createdBy: anna,
      paidByMemberId: trip.members.anna,
      amountMinor: 1000,
      shares: equalShares(1000, [trip.members.anna, trip.members.boris]),
    });

    const state = await removeTripMemberAction(trip.id, trip.members.boris);

    expect(state?.error).toContain("участвует в расходах");
    expect(await prisma.tripMember.count({ where: { id: trip.members.boris } })).toBe(1);
  });

  it("не отпускает того, по кому отмечен перевод", async () => {
    await prisma.settlement.create({
      data: {
        tripId: trip.id,
        fromMemberId: trip.members.boris,
        toMemberId: trip.members.anna,
        amountMinor: 500,
        markedById: anna.id,
      },
    });

    expect(await removeTripMemberAction(trip.id, trip.members.boris)).toEqual({
      error: "По этому участнику уже отмечены переводы",
    });
  });

  it("отпускает того, кто ни в чём не замешан", async () => {
    expect(await removeTripMemberAction(trip.id, trip.members.boris)).toBeNull();
    expect(await prisma.tripMember.count({ where: { tripId: trip.id } })).toBe(1);
  });

  it("не убирает участника чужой поездки под видом своего", async () => {
    const other = await createTrip({ createdBy: outsider });

    expect(await removeTripMemberAction(trip.id, other.members.outsider)).toEqual({
      error: "Участник не найден",
    });
    expect(await prisma.tripMember.count({ where: { id: other.members.outsider } })).toBe(1);
  });
});

describe("привязка гостя к аккаунту", () => {
  let guestId: string;

  beforeEach(async () => {
    await signIn(anna);
    trip = await createTrip({ createdBy: anna, members: [boris], guests: ["Дима"] });
    guestId = trip.members["Дима"];
  });

  it("возможна только для своего друга", async () => {
    expect(await linkGuestToUserAction(trip.id, guestId, outsider.id)).toEqual({
      error: "Привязать можно только своего друга",
    });

    const member = await prisma.tripMember.findUnique({
      where: { id: guestId },
      select: { userId: true },
    });
    expect(member?.userId).toBeNull();
  });

  it("не сводит в поездке одного человека дважды", async () => {
    expect(await linkGuestToUserAction(trip.id, guestId, boris.id)).toEqual({
      error: "Этот человек уже участвует в поездке отдельно",
    });
  });

  // Расходы ссылаются на участника поездки, а не на пользователя, поэтому
  // привязка не должна ничего переносить.
  it("сохраняет расходы гостя", async () => {
    const dima = await createUser("dima");
    await makeFriends(anna, dima);
    await createExpense({
      tripId: trip.id,
      createdBy: anna,
      paidByMemberId: guestId,
      amountMinor: 900,
      shares: equalShares(900, [trip.members.anna, trip.members.boris, guestId]),
    });

    expect(await linkGuestToUserAction(trip.id, guestId, dima.id)).toBeNull();

    const member = await prisma.tripMember.findUnique({
      where: { id: guestId },
      select: {
        userId: true,
        guestName: true,
        _count: { select: { paidExpenses: true, shares: true } },
      },
    });
    expect(member).toEqual({
      userId: dima.id,
      guestName: null,
      _count: { paidExpenses: 1, shares: 1 },
    });
  });
});

describe("удаление поездки", () => {
  it("недоступно участнику, который её не создавал", async () => {
    await signIn(boris);

    expect(await deleteTripAction(trip.id)).toEqual({
      error: "Удалить поездку может только тот, кто её создал",
    });
    expect(await prisma.trip.count({ where: { id: trip.id } })).toBe(1);
  });

  it("создателем уносит и содержимое поездки", async () => {
    await signIn(anna);
    await createExpense({
      tripId: trip.id,
      createdBy: anna,
      paidByMemberId: trip.members.anna,
      amountMinor: 1000,
      shares: equalShares(1000, [trip.members.anna, trip.members.boris]),
    });
    await prisma.settlement.create({
      data: {
        tripId: trip.id,
        fromMemberId: trip.members.boris,
        toMemberId: trip.members.anna,
        amountMinor: 500,
        markedById: anna.id,
      },
    });

    expect(await expectRedirect(deleteTripAction(trip.id))).toBe("/");

    expect(await prisma.trip.count()).toBe(0);
    expect(await prisma.tripMember.count()).toBe(0);
    expect(await prisma.expense.count()).toBe(0);
    expect(await prisma.expenseShare.count()).toBe(0);
    expect(await prisma.settlement.count()).toBe(0);
    // Пользователи и дружба переживают удаление поездки.
    expect(await prisma.user.count()).toBe(3);
  });
});
