"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { prisma } from "@/lib/db";
import type { FormState } from "@/lib/actions/form-state";

/**
 * Обновляет не только страницу друзей, но и весь каркас: счётчик заявок висит
 * на вкладке «Друзья», то есть в layout, и после ответа на заявку он должен
 * пропасть на любом экране, а не только на том, где нажали кнопку.
 */
function revalidateFriends() {
  revalidatePath("/", "layout");
}

/**
 * Отправляет заявку в друзья.
 *
 * Если встречная заявка уже висит, вместо второй записи принимаем её: иначе в
 * базе оказались бы две записи об одной дружбе, и было бы непонятно, какую из
 * них удалять при разрыве.
 */
export async function sendFriendRequestAction(targetUserId: string): Promise<FormState> {
  const user = await requireUser();

  if (targetUserId === user.id) {
    return { error: "Нельзя добавить в друзья самого себя" };
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: targetUserId },
        { requesterId: targetUserId, addresseeId: user.id },
      ],
    },
    select: { id: true, status: true, requesterId: true },
  });

  if (existing?.status === "ACCEPTED") {
    return { error: "Вы уже друзья" };
  }

  if (existing) {
    if (existing.requesterId === user.id) {
      return { error: "Заявка уже отправлена" };
    }
    await prisma.friendship.update({
      where: { id: existing.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    });
  } else {
    await prisma.friendship.create({
      data: { requesterId: user.id, addresseeId: targetUserId },
    });
  }

  revalidateFriends();
  return null;
}

export async function acceptFriendRequestAction(friendshipId: string): Promise<FormState> {
  const user = await requireUser();

  // Принять заявку может только адресат — проверяем это условием обновления,
  // чтобы чужой идентификатор просто ничего не изменил.
  const { count } = await prisma.friendship.updateMany({
    where: { id: friendshipId, addresseeId: user.id, status: "PENDING" },
    data: { status: "ACCEPTED", respondedAt: new Date() },
  });

  if (count === 0) return { error: "Заявка не найдена" };

  revalidateFriends();
  return null;
}

/** Отклонение входящей заявки и отмена своей исходящей — одно и то же удаление. */
export async function removeFriendshipAction(friendshipId: string): Promise<FormState> {
  const user = await requireUser();

  const { count } = await prisma.friendship.deleteMany({
    where: {
      id: friendshipId,
      OR: [{ requesterId: user.id }, { addresseeId: user.id }],
    },
  });

  if (count === 0) return { error: "Не найдено" };

  // Участники общих поездок при этом остаются на месте: убрать человека из
  // поездки задним числом означало бы разрушить уже посчитанные долги.
  revalidateFriends();
  return null;
}
