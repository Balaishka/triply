"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import type { FormState } from "@/lib/actions/form-state";
import { MAX_AMOUNT_MINOR } from "@/lib/settlement";

/**
 * Отметки о переводах.
 *
 * В отличие от расходов, они работают и в завершённой поездке: ради того, чтобы
 * отметить «перевёл», её чаще всего и открывают после возвращения.
 */
async function requireMembership(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, members: { select: { id: true, userId: true } } },
  });

  if (!trip || !trip.members.some((member) => member.userId === userId)) return null;
  return trip;
}

export async function markTransferPaidAction(
  tripId: string,
  fromMemberId: string,
  toMemberId: string,
  amountMinor: number,
): Promise<FormState> {
  const user = await requireUser();
  const trip = await requireMembership(tripId, user.id);
  if (!trip) return { error: "Поездка не найдена" };

  const memberIds = new Set(trip.members.map((member) => member.id));
  if (!memberIds.has(fromMemberId) || !memberIds.has(toMemberId)) {
    return { error: "Участник не найден" };
  }
  if (fromMemberId === toMemberId) {
    return { error: "Перевод самому себе ничего не меняет" };
  }
  if (!Number.isInteger(amountMinor) || amountMinor <= 0 || amountMinor > MAX_AMOUNT_MINOR) {
    return { error: "Неверная сумма перевода" };
  }

  await prisma.settlement.create({
    data: { tripId, fromMemberId, toMemberId, amountMinor, markedById: user.id },
  });

  revalidatePath(`/trips/${tripId}`);
  return null;
}

/** Отменяет ошибочную отметку — долг возвращается в список. */
export async function unmarkTransferAction(tripId: string, settlementId: string): Promise<FormState> {
  const user = await requireUser();
  const trip = await requireMembership(tripId, user.id);
  if (!trip) return { error: "Поездка не найдена" };

  const { count } = await prisma.settlement.deleteMany({ where: { id: settlementId, tripId } });
  if (count === 0) return { error: "Отметка не найдена" };

  revalidatePath(`/trips/${tripId}`);
  return null;
}
