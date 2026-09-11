import { beforeEach, describe, expect, it } from "vitest";

import {
  createTripInviteAction,
  joinTripAction,
  revokeTripInviteAction,
} from "@/lib/actions/invites";
import { prisma } from "@/lib/db";
import { INVITE_BROKEN, INVITE_COMPLETED } from "@/lib/trips/invite-link";
import { setUpTestDatabase } from "@/test/db";
import {
  createExpense,
  createInvite,
  createTrip,
  createUser,
  signIn,
  signOut,
  type TestTrip,
  type TestUser,
} from "@/test/factories";
import { expectRedirect } from "@/test/redirect";

/**
 * Приглашение по ссылке — единственная дверь в поездку, открытая не другу.
 *
 * Поэтому проверяется и то, что ссылкой распоряжаются только участники, и то,
 * что сама ссылка пускает ровно туда, куда выдана: чужую поездку по ней не
 * открыть, в завершённую не войти, а место гостя не занять дважды.
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
});

function invites(tripId: string) {
  return prisma.tripInvite.count({ where: { tripId } });
}

function members(tripId: string) {
  return prisma.tripMember.count({ where: { tripId } });
}

describe("посторонний", () => {
  beforeEach(async () => {
    await signIn(outsider);
  });

  it("не создаёт ссылку в чужую поездку", async () => {
    const state = await createTripInviteAction(trip.id);

    expect(state).toEqual({ error: "Поездка не найдена" });
    expect(await invites(trip.id)).toBe(0);
  });

  it("не отзывает чужую ссылку", async () => {
    await createInvite(trip.id, anna);

    const state = await revokeTripInviteAction(trip.id);

    expect(state).toEqual({ error: "Поездка не найдена" });
    expect(await invites(trip.id)).toBe(1);
  });
});

describe("не вошедший", () => {
  beforeEach(() => {
    signOut();
  });

  it("отправляется на вход вместо создания ссылки", async () => {
    expect(await expectRedirect(createTripInviteAction(trip.id))).toBe("/login");
    expect(await invites(trip.id)).toBe(0);
  });

  it("отправляется на вход вместо присоединения", async () => {
    const token = await createInvite(trip.id, anna);

    expect(await expectRedirect(joinTripAction(token, null))).toBe("/login");
    expect(await members(trip.id)).toBe(2);
  });
});

describe("участник поездки", () => {
  beforeEach(async () => {
    await signIn(boris);
  });

  it("создаёт ссылку", async () => {
    expect(await createTripInviteAction(trip.id)).toBeNull();

    const invite = await prisma.tripInvite.findUnique({ where: { tripId: trip.id } });
    expect(invite?.createdById).toBe(boris.id);
    expect(invite?.token.length).toBeGreaterThan(16);
  });

  // Ссылка на поездку одна: повторное нажатие не должно ломать ту, что уже
  // разошлась по чату.
  it("повторным нажатием не меняет уже выпущенную ссылку", async () => {
    const token = await createInvite(trip.id, anna);

    expect(await createTripInviteAction(trip.id)).toBeNull();

    const invite = await prisma.tripInvite.findUnique({ where: { tripId: trip.id } });
    expect(invite?.token).toBe(token);
    expect(await invites(trip.id)).toBe(1);
  });

  it("отзывает ссылку", async () => {
    await createInvite(trip.id, anna);

    expect(await revokeTripInviteAction(trip.id)).toBeNull();
    expect(await invites(trip.id)).toBe(0);
  });
});

describe("завершённая поездка", () => {
  let completed: TestTrip;

  beforeEach(async () => {
    completed = await createTrip({ createdBy: anna, members: [boris], status: "COMPLETED" });
    await signIn(anna);
  });

  it("не выпускает новую ссылку", async () => {
    const state = await createTripInviteAction(completed.id);

    expect(state).toEqual({ error: "Поездка завершена — сначала откройте её заново" });
    expect(await invites(completed.id)).toBe(0);
  });

  // Отзыв — не запись в поездку, а отказ от неё: закрыть дверь можно всегда.
  it("отзывает ссылку, оставшуюся с прошлого раза", async () => {
    await createInvite(completed.id, anna);

    expect(await revokeTripInviteAction(completed.id)).toBeNull();
    expect(await invites(completed.id)).toBe(0);
  });

  it("не пускает по ссылке нового участника", async () => {
    const token = await createInvite(completed.id, anna);
    await signIn(outsider);

    expect(await joinTripAction(token, null)).toEqual({ error: INVITE_COMPLETED });
    expect(await members(completed.id)).toBe(2);
  });
});

describe("переход по ссылке", () => {
  let token: string;

  beforeEach(async () => {
    token = await createInvite(trip.id, anna);
    await signIn(outsider);
  });

  // Ради этого всё и затевалось: дружба для входа в поездку не требуется.
  it("пускает человека, который никому здесь не друг", async () => {
    expect(await expectRedirect(joinTripAction(token, null))).toBe(`/trips/${trip.id}`);

    const member = await prisma.tripMember.findFirst({
      where: { tripId: trip.id, userId: outsider.id },
    });
    expect(member).not.toBeNull();
    expect(member?.addedById).toBe(outsider.id);
  });

  it("по отозванной ссылке в поездку не попасть", async () => {
    await prisma.tripInvite.deleteMany({ where: { tripId: trip.id } });

    expect(await joinTripAction(token, null)).toEqual({ error: INVITE_BROKEN });
    expect(await members(trip.id)).toBe(2);
  });

  it("выдуманный токен ничего не открывает", async () => {
    expect(await joinTripAction("токен-из-головы", null)).toEqual({ error: INVITE_BROKEN });
    expect(await members(trip.id)).toBe(2);
  });

  it("участника просто уводит в поездку, не заводя второго", async () => {
    await signIn(boris);

    expect(await expectRedirect(joinTripAction(token, null))).toBe(`/trips/${trip.id}`);
    expect(await members(trip.id)).toBe(2);
  });
});

describe("место гостя", () => {
  let token: string;
  let guests: TestTrip;

  beforeEach(async () => {
    guests = await createTrip({ createdBy: anna, members: [boris], guests: ["Вася"] });
    token = await createInvite(guests.id, anna);
    await signIn(outsider);
  });

  /**
   * Смысл всей затеи с гостями: расходы ссылаются на участника поездки, поэтому
   * занять место — это проставить `userId`, и уже записанные доли остаются на
   * месте.
   */
  it("достаётся пришедшему вместе с его расходами", async () => {
    await createExpense({
      tripId: guests.id,
      createdBy: anna,
      paidByMemberId: guests.members["Вася"],
      amountMinor: 3000,
      shares: [{ memberId: guests.members["Вася"], amountMinor: 3000 }],
    });

    expect(await expectRedirect(joinTripAction(token, guests.members["Вася"]))).toBe(
      `/trips/${guests.id}`,
    );

    const member = await prisma.tripMember.findUnique({
      where: { id: guests.members["Вася"] },
      select: { userId: true, guestName: true, _count: { select: { paidExpenses: true } } },
    });
    expect(member).toEqual({ userId: outsider.id, guestName: null, _count: { paidExpenses: 1 } });
    // Участников столько же: гость стал пришедшим, а не появился рядом с ним.
    expect(await members(guests.id)).toBe(3);
  });

  it("занятое место второй раз не занять", async () => {
    const other = await createUser("other");
    await prisma.tripMember.update({
      where: { id: guests.members["Вася"] },
      data: { userId: other.id, guestName: null },
    });

    const state = await joinTripAction(token, guests.members["Вася"]);

    expect(state).toEqual({
      error: "Это место уже занято или его больше нет. Обновите страницу и выберите заново.",
    });
    const member = await prisma.tripMember.findUnique({
      where: { id: guests.members["Вася"] },
      select: { userId: true },
    });
    expect(member?.userId).toBe(other.id);
    expect(await members(guests.id)).toBe(3);
  });

  it("чужой поездки по этой ссылке не касается", async () => {
    const stranger = await createTrip({ createdBy: anna, guests: ["Петя"] });

    const state = await joinTripAction(token, stranger.members["Петя"]);

    expect(state).toEqual({
      error: "Это место уже занято или его больше нет. Обновите страницу и выберите заново.",
    });
    const member = await prisma.tripMember.findUnique({
      where: { id: stranger.members["Петя"] },
      select: { userId: true, guestName: true },
    });
    expect(member).toEqual({ userId: null, guestName: "Петя" });
    expect(await members(guests.id)).toBe(3);
  });
});
