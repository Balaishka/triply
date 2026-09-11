import { createSession } from "@/lib/auth/session";
import { randomToken } from "@/lib/auth/token";
import { prisma } from "@/lib/db";
import { INVITE_TOKEN_BYTES } from "@/lib/trips/invite-link";

import { clearCookies } from "./cookies";

/**
 * Заготовки данных для тестов на права.
 *
 * Всё пишется в базу настоящими запросами, но мимо действий: тест про
 * «постороннему нельзя» не должен начинаться с десяти разрешённых действий,
 * иначе он проверяет их заодно и падает вместе с ними.
 */

export interface TestUser {
  id: string;
  email: string;
  nickname: string;
}

/**
 * Пароль здесь строкой-заглушкой: ни одно проверяемое действие его не читает,
 * а честный argon2 на каждого пользователя стоил бы больше, чем весь прогон.
 */
export function createUser(nickname: string): Promise<TestUser> {
  return prisma.user.create({
    data: {
      email: `${nickname}@triply.test`,
      nickname,
      passwordHash: "argon2-заглушка",
    },
    select: { id: true, email: true, nickname: true },
  });
}

/** Подтверждённая дружба — то самое согласие, без которого нельзя добавить в поездку. */
export async function makeFriends(a: TestUser, b: TestUser): Promise<void> {
  await prisma.friendship.create({
    data: {
      requesterId: a.id,
      addresseeId: b.id,
      status: "ACCEPTED",
      respondedAt: new Date(),
    },
  });
}

/** Входит под пользователем: настоящая сессия в базе и токен в cookie. */
export async function signIn(user: TestUser): Promise<void> {
  clearCookies();
  await createSession(user.id);
}

/** Выходит: без cookie действие должно увести на вход. */
export function signOut(): void {
  clearCookies();
}

export interface TripOptions {
  createdBy: TestUser;
  /** Участники помимо создателя — он попадает в поездку всегда. */
  members?: TestUser[];
  /** Участники без аккаунта, по именам. */
  guests?: string[];
  name?: string;
  currency?: string;
  status?: "ACTIVE" | "COMPLETED";
}

export interface TestTrip {
  id: string;
  /** Идентификаторы `TripMember` по нику или имени гостя. */
  members: Record<string, string>;
}

export async function createTrip(options: TripOptions): Promise<TestTrip> {
  const users = [options.createdBy, ...(options.members ?? [])];
  const completed = options.status === "COMPLETED";

  const trip = await prisma.trip.create({
    data: {
      name: options.name ?? "Поездка",
      currency: options.currency ?? "RUB",
      status: options.status ?? "ACTIVE",
      completedAt: completed ? new Date() : null,
      createdById: options.createdBy.id,
      members: {
        create: [
          ...users.map((user) => ({ userId: user.id, addedById: options.createdBy.id })),
          ...(options.guests ?? []).map((guestName) => ({
            guestName,
            addedById: options.createdBy.id,
          })),
        ],
      },
    },
    select: {
      id: true,
      members: { select: { id: true, userId: true, guestName: true } },
    },
  });

  const nicknameById = new Map(users.map((user) => [user.id, user.nickname]));
  const members: Record<string, string> = {};
  for (const member of trip.members) {
    const key = member.userId ? nicknameById.get(member.userId) : member.guestName;
    if (key) members[key] = member.id;
  }

  return { id: trip.id, members };
}

/**
 * Готовая ссылка-приглашение — возвращается её токен.
 *
 * Заводится запросом, а не действием: тест про «пришёл по ссылке» не должен
 * начинаться с выпуска ссылки и падать вместе с ним.
 */
export async function createInvite(tripId: string, createdBy: TestUser): Promise<string> {
  const invite = await prisma.tripInvite.create({
    data: {
      tripId,
      token: randomToken(INVITE_TOKEN_BYTES),
      createdById: createdBy.id,
    },
    select: { token: true },
  });

  return invite.token;
}

export interface ExpenseOptions {
  tripId: string;
  createdBy: TestUser;
  paidByMemberId: string;
  amountMinor: number;
  shares: { memberId: string; amountMinor: number }[];
  title?: string;
  spentAt?: string;
}

/** Возвращает идентификатор расхода. */
export async function createExpense(options: ExpenseOptions): Promise<string> {
  const expense = await prisma.expense.create({
    data: {
      tripId: options.tripId,
      title: options.title ?? "Обед",
      amountMinor: options.amountMinor,
      paidByMemberId: options.paidByMemberId,
      spentAt: new Date(`${options.spentAt ?? "2026-09-01"}T00:00:00.000Z`),
      createdById: options.createdBy.id,
      shares: { create: options.shares },
    },
    select: { id: true },
  });
  return expense.id;
}

/** Делит сумму поровну — ровно так, как это сделала бы форма расхода. */
export function equalShares(
  amountMinor: number,
  memberIds: string[],
): { memberId: string; amountMinor: number }[] {
  const base = Math.floor(amountMinor / memberIds.length);
  const remainder = amountMinor - base * memberIds.length;
  return memberIds.map((memberId, index) => ({
    memberId,
    amountMinor: base + (index < remainder ? 1 : 0),
  }));
}

/** Форма поездки — то, что уходит из `TripForm`. */
export function tripForm(fields: {
  name?: string;
  startDate?: string;
  endDate?: string;
  currency?: string;
}): FormData {
  const form = new FormData();
  form.set("name", fields.name ?? "Поездка");
  form.set("startDate", fields.startDate ?? "");
  form.set("endDate", fields.endDate ?? "");
  form.set("currency", fields.currency ?? "RUB");
  return form;
}

/** Форма расхода: доли клиент присылает уже посчитанными, строкой JSON. */
export function expenseForm(fields: {
  title?: string;
  amountMinor: number;
  paidByMemberId: string;
  spentAt?: string;
  splitMode?: "EQUAL" | "MANUAL";
  shares: { memberId: string; amountMinor: number }[];
}): FormData {
  const form = new FormData();
  form.set("title", fields.title ?? "Обед");
  form.set("amountMinor", String(fields.amountMinor));
  form.set("paidByMemberId", fields.paidByMemberId);
  form.set("spentAt", fields.spentAt ?? "2026-09-01");
  form.set("splitMode", fields.splitMode ?? "EQUAL");
  form.set("shares", JSON.stringify(fields.shares));
  return form;
}
