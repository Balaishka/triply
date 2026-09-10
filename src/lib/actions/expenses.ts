"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import { fieldErrorsFrom, type FormState } from "@/lib/actions/form-state";
import { fromISODate } from "@/lib/dates";
import { expenseSchema } from "@/lib/validation";

/** Поездка, в которой пользователь состоит и которая открыта на запись. */
async function requireEditableTrip(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
      members: { select: { id: true, userId: true } },
    },
  });

  if (!trip || !trip.members.some((member) => member.userId === userId)) {
    return { trip: null, error: "Поездка не найдена" as const };
  }
  if (trip.status === "COMPLETED") {
    return { trip: null, error: "Поездка завершена — сначала откройте её заново" as const };
  }
  return { trip, error: null };
}

/**
 * Разбирает и проверяет форму расхода.
 *
 * Клиент присылает уже посчитанные доли, но верить им нельзя: проверяем и что
 * все участники из этой поездки, и что доли складываются в сумму чека. Иначе
 * подделанный запрос развалил бы весь расчёт поездки.
 */
function parseExpenseForm(formData: FormData, memberIds: Set<string>) {
  let shares: unknown;
  try {
    shares = JSON.parse(String(formData.get("shares") ?? "[]"));
  } catch {
    return { data: null, state: { error: "Не удалось разобрать доли" } as FormState };
  }

  const parsed = expenseSchema.safeParse({
    title: formData.get("title"),
    amountMinor: Number(formData.get("amountMinor")),
    paidByMemberId: formData.get("paidByMemberId"),
    spentAt: formData.get("spentAt"),
    splitMode: formData.get("splitMode"),
    shares,
  });

  if (!parsed.success) return { data: null, state: fieldErrorsFrom(parsed.error) };

  if (!memberIds.has(parsed.data.paidByMemberId)) {
    return { data: null, state: { fieldErrors: { paidByMemberId: "Этот человек не в поездке" } } };
  }
  if (parsed.data.shares.some((share) => !memberIds.has(share.memberId))) {
    return { data: null, state: { fieldErrors: { shares: "Среди участников расхода есть посторонние" } } };
  }

  return { data: parsed.data, state: null };
}

export async function createExpenseAction(
  tripId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const { trip, error } = await requireEditableTrip(tripId, user.id);
  if (!trip) return { error };

  const memberIds = new Set(trip.members.map((member) => member.id));
  const { data, state } = parseExpenseForm(formData, memberIds);
  if (!data) return state;

  await prisma.expense.create({
    data: {
      tripId,
      title: data.title,
      amountMinor: data.amountMinor,
      paidByMemberId: data.paidByMemberId,
      spentAt: fromISODate(data.spentAt),
      splitMode: data.splitMode,
      createdById: user.id,
      shares: { create: data.shares },
    },
  });

  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function updateExpenseAction(
  tripId: string,
  expenseId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const { trip, error } = await requireEditableTrip(tripId, user.id);
  if (!trip) return { error };

  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, tripId },
    select: { id: true },
  });
  if (!existing) return { error: "Расход не найден" };

  const memberIds = new Set(trip.members.map((member) => member.id));
  const { data, state } = parseExpenseForm(formData, memberIds);
  if (!data) return state;

  // Доли переписываем целиком: вычислять, какие изменились, дороже и рискованнее,
  // чем заменить весь набор одной транзакцией.
  await prisma.$transaction([
    prisma.expenseShare.deleteMany({ where: { expenseId } }),
    prisma.expense.update({
      where: { id: expenseId },
      data: {
        title: data.title,
        amountMinor: data.amountMinor,
        paidByMemberId: data.paidByMemberId,
        spentAt: fromISODate(data.spentAt),
        splitMode: data.splitMode,
        shares: { create: data.shares },
      },
    }),
  ]);

  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function deleteExpenseAction(tripId: string, expenseId: string): Promise<FormState> {
  const user = await requireUser();
  const { trip, error } = await requireEditableTrip(tripId, user.id);
  if (!trip) return { error };

  const { count } = await prisma.expense.deleteMany({ where: { id: expenseId, tripId } });
  if (count === 0) return { error: "Расход не найден" };

  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}
