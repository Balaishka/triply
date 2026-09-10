"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { fieldErrorsFrom, type FormState } from "@/lib/actions/form-state";
import { getFriendIds } from "@/lib/queries/friends";
import { fromISODate } from "@/lib/dates";
import { DEFAULT_CURRENCY } from "@/lib/money";
import { guestSchema, tripSchema } from "@/lib/validation";

/**
 * Проверяет, что пользователь состоит в поездке.
 *
 * Все действия начинаются с этой проверки: наличие идентификатора поездки в
 * запросе ничего не доказывает.
 */
async function requireMembership(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
      createdById: true,
      members: { where: { userId }, select: { id: true } },
    },
  });

  if (!trip || trip.members.length === 0) return null;
  return trip;
}

/** То же, но ещё и требует, чтобы поездка не была завершена. */
async function requireEditable(tripId: string, userId: string) {
  const trip = await requireMembership(tripId, userId);
  if (!trip) return { trip: null, error: "Поездка не найдена" as const };
  if (trip.status === "COMPLETED") {
    return { trip: null, error: "Поездка завершена — сначала откройте её заново" as const };
  }
  return { trip, error: null };
}

export async function createTripAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = tripSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
    currency: formData.get("currency") ?? DEFAULT_CURRENCY,
  });

  if (!parsed.success) return fieldErrorsFrom(parsed.error);

  const { name, startDate, endDate, currency } = parsed.data;

  const trip = await prisma.trip.create({
    data: {
      name,
      currency,
      startDate: startDate ? fromISODate(startDate) : null,
      endDate: endDate ? fromISODate(endDate) : null,
      createdById: user.id,
      // Создатель сразу становится участником: поездка без него бессмысленна.
      members: { create: { userId: user.id, addedById: user.id } },
    },
    select: { id: true },
  });

  redirect(`/trips/${trip.id}`);
}

export async function updateTripAction(
  tripId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const { trip, error } = await requireEditable(tripId, user.id);
  if (!trip) return { error };

  const parsed = tripSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate") ?? "",
    endDate: formData.get("endDate") ?? "",
    currency: formData.get("currency") ?? DEFAULT_CURRENCY,
  });

  if (!parsed.success) return fieldErrorsFrom(parsed.error);

  const { name, startDate, endDate, currency } = parsed.data;

  await prisma.trip.update({
    where: { id: tripId },
    data: {
      name,
      currency,
      startDate: startDate ? fromISODate(startDate) : null,
      endDate: endDate ? fromISODate(endDate) : null,
    },
  });

  revalidatePath(`/trips/${tripId}`);
  return null;
}

/** Добавляет в поездку друга. Чужого человека добавить нельзя — дружба и есть согласие. */
export async function addFriendToTripAction(tripId: string, friendUserId: string): Promise<FormState> {
  const user = await requireUser();
  const { trip, error } = await requireEditable(tripId, user.id);
  if (!trip) return { error };

  const friendIds = await getFriendIds(user.id);
  if (!friendIds.has(friendUserId)) {
    return { error: "Добавить в поездку можно только своего друга" };
  }

  const existing = await prisma.tripMember.findFirst({
    where: { tripId, userId: friendUserId },
    select: { id: true },
  });
  if (existing) return { error: "Он уже в поездке" };

  await prisma.tripMember.create({
    data: { tripId, userId: friendUserId, addedById: user.id },
  });

  revalidatePath(`/trips/${tripId}`);
  return null;
}

/** Добавляет участника без аккаунта — просто именем. */
export async function addGuestToTripAction(
  tripId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const { trip, error } = await requireEditable(tripId, user.id);
  if (!trip) return { error };

  const parsed = guestSchema.safeParse({ guestName: formData.get("guestName") });
  if (!parsed.success) return fieldErrorsFrom(parsed.error);

  await prisma.tripMember.create({
    data: { tripId, guestName: parsed.data.guestName, addedById: user.id },
  });

  revalidatePath(`/trips/${tripId}`);
  return null;
}

/**
 * Привязывает гостя к аккаунту друга.
 *
 * Вся история расходов гостя остаётся на месте: расходы ссылаются на участника
 * поездки, а не на пользователя, поэтому достаточно проставить `userId`.
 */
export async function linkGuestToUserAction(
  tripId: string,
  memberId: string,
  friendUserId: string,
): Promise<FormState> {
  const user = await requireUser();
  const { trip, error } = await requireEditable(tripId, user.id);
  if (!trip) return { error };

  const friendIds = await getFriendIds(user.id);
  if (!friendIds.has(friendUserId)) {
    return { error: "Привязать можно только своего друга" };
  }

  const member = await prisma.tripMember.findFirst({
    where: { id: memberId, tripId },
    select: { id: true, userId: true },
  });
  if (!member) return { error: "Участник не найден" };
  if (member.userId) return { error: "Этот участник уже привязан к аккаунту" };

  const alreadyMember = await prisma.tripMember.findFirst({
    where: { tripId, userId: friendUserId },
    select: { id: true },
  });
  if (alreadyMember) return { error: "Этот человек уже участвует в поездке отдельно" };

  await prisma.tripMember.update({
    where: { id: memberId },
    data: { userId: friendUserId, guestName: null },
  });

  revalidatePath(`/trips/${tripId}`);
  return null;
}

/**
 * Убирает участника из поездки.
 *
 * Участника, который платил или числится в расходах, удалить нельзя: иначе
 * из расчёта пропала бы часть долей и итоговые суммы перестали бы сходиться.
 * Сообщаем, что именно мешает, вместо глухого отказа.
 */
export async function removeTripMemberAction(tripId: string, memberId: string): Promise<FormState> {
  const user = await requireUser();
  const { trip, error } = await requireEditable(tripId, user.id);
  if (!trip) return { error };

  const member = await prisma.tripMember.findFirst({
    where: { id: memberId, tripId },
    select: {
      id: true,
      userId: true,
      guestName: true,
      user: { select: { nickname: true } },
      _count: { select: { paidExpenses: true, shares: true, settlementsFrom: true, settlementsTo: true } },
    },
  });

  if (!member) return { error: "Участник не найден" };

  if (member.userId === trip.createdById) {
    return { error: "Создателя поездки убрать нельзя" };
  }

  const { paidExpenses, shares, settlementsFrom, settlementsTo } = member._count;
  if (paidExpenses > 0 || shares > 0) {
    const name = member.user?.nickname ?? member.guestName ?? "Участник";
    return {
      error: `${name} участвует в расходах. Сначала уберите его из них или удалите эти расходы.`,
    };
  }
  if (settlementsFrom > 0 || settlementsTo > 0) {
    return { error: "По этому участнику уже отмечены переводы" };
  }

  await prisma.tripMember.delete({ where: { id: memberId } });

  revalidatePath(`/trips/${tripId}`);
  return null;
}

export async function completeTripAction(tripId: string): Promise<FormState> {
  const user = await requireUser();
  const trip = await requireMembership(tripId, user.id);
  if (!trip) return { error: "Поездка не найдена" };

  await prisma.trip.update({
    where: { id: tripId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}/summary`);
}

export async function reopenTripAction(tripId: string): Promise<FormState> {
  const user = await requireUser();
  const trip = await requireMembership(tripId, user.id);
  if (!trip) return { error: "Поездка не найдена" };

  await prisma.trip.update({
    where: { id: tripId },
    data: { status: "ACTIVE", completedAt: null },
  });

  revalidatePath(`/trips/${tripId}`);
  return null;
}

/** Удаление поездки — только создателем и со всем содержимым. */
export async function deleteTripAction(tripId: string): Promise<FormState> {
  const user = await requireUser();

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, createdById: true },
  });

  if (!trip) return { error: "Поездка не найдена" };
  if (trip.createdById !== user.id) {
    return { error: "Удалить поездку может только тот, кто её создал" };
  }

  // Порядок важен: доли и расходы ссылаются на участников, поэтому участники
  // удаляются последними. Полагаться на каскад базы здесь нельзя — внешние
  // ключи на участников намеренно запрещают удаление, пока на них ссылаются.
  await prisma.$transaction([
    prisma.expenseShare.deleteMany({ where: { expense: { tripId } } }),
    prisma.expense.deleteMany({ where: { tripId } }),
    prisma.settlement.deleteMany({ where: { tripId } }),
    prisma.tripMember.deleteMany({ where: { tripId } }),
    prisma.trip.delete({ where: { id: tripId } }),
  ]);

  redirect("/");
}
