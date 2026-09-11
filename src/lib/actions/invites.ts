"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { requireUser } from "@/lib/auth/require-user";
import { randomToken } from "@/lib/auth/token";
import { prisma } from "@/lib/db";
import type { FormState } from "@/lib/actions/form-state";
import {
  INVITE_BROKEN,
  INVITE_COMPLETED,
  INVITE_TOKEN_BYTES,
  inviteOutcome,
} from "@/lib/trips/invite-link";

/**
 * Приглашение в поездку ссылкой.
 *
 * Ссылка — это и есть согласие: добавить в поездку напрямую можно только друга,
 * а по ссылке приходит кто угодно, кому её дали. Поэтому распоряжаются ссылкой
 * только участники поездки, а сама она живёт, пока поездка активна.
 */

/** Участие в поездке: идентификатор в запросе сам по себе ничего не доказывает. */
async function requireMembership(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
      members: { where: { userId }, select: { id: true } },
    },
  });

  if (!trip || trip.members.length === 0) return null;
  return trip;
}

/**
 * Заводит ссылку-приглашение или оставляет уже готовую.
 *
 * Повторное нажатие ничего не меняет: ссылка на поездку одна, и второй раз
 * создать её нечем — мешает уникальность `tripId`. Это же спасает от двух
 * ссылок, выпущенных одновременно с двух телефонов.
 */
export async function createTripInviteAction(tripId: string): Promise<FormState> {
  const user = await requireUser();

  const trip = await requireMembership(tripId, user.id);
  if (!trip) return { error: "Поездка не найдена" };
  if (trip.status === "COMPLETED") {
    return { error: "Поездка завершена — сначала откройте её заново" };
  }

  await prisma.tripInvite.upsert({
    where: { tripId },
    create: { tripId, token: randomToken(INVITE_TOKEN_BYTES), createdById: user.id },
    update: {},
  });

  revalidatePath(`/trips/${tripId}/settings`);
  return null;
}

/**
 * Отзывает ссылку: строка удаляется, и ссылка из чужого чата перестаёт
 * работать. Следующая заводится с новым токеном.
 *
 * Завершённость поездки здесь не проверяется, в отличие от выпуска: закрыть
 * дверь можно всегда — это не запись в поездку, а отказ от неё.
 */
export async function revokeTripInviteAction(tripId: string): Promise<FormState> {
  const user = await requireUser();

  const trip = await requireMembership(tripId, user.id);
  if (!trip) return { error: "Поездка не найдена" };

  await prisma.tripInvite.deleteMany({ where: { tripId } });

  revalidatePath(`/trips/${tripId}/settings`);
  return null;
}

/**
 * Присоединение к поездке по ссылке.
 *
 * `guestMemberId` — место гостя, которое пришедший объявляет своим: гостя в
 * поездке уже завели и что-то на него записали. Расходы ссылаются на участника
 * поездки, а не на пользователя, поэтому занять место — это проставить `userId`,
 * и вся история остаётся на месте.
 */
export async function joinTripAction(
  token: string,
  guestMemberId: string | null,
): Promise<FormState> {
  const user = await requireUser();

  const invite = await prisma.tripInvite.findUnique({
    where: { token },
    select: {
      trip: {
        select: { id: true, status: true, members: { select: { userId: true } } },
      },
    },
  });

  const trip = invite?.trip ?? null;
  const outcome = inviteOutcome(
    trip && {
      tripStatus: trip.status,
      viewerIsMember: trip.members.some((member) => member.userId === user.id),
    },
  );

  if (!trip || outcome === "broken") return { error: INVITE_BROKEN };
  if (outcome === "completed") return { error: INVITE_COMPLETED };
  if (outcome === "member") redirect(`/trips/${trip.id}`);

  if (guestMemberId) {
    // Условиями обновления, а не проверкой заранее: между проверкой и записью
    // гостя мог занять кто-то другой, и тогда двое стали бы одним участником.
    const { count } = await prisma.tripMember.updateMany({
      where: { id: guestMemberId, tripId: trip.id, userId: null },
      data: { userId: user.id, guestName: null },
    });

    if (count === 0) {
      return { error: "Это место уже занято или его больше нет. Обновите страницу и выберите заново." };
    }
  } else {
    try {
      await prisma.tripMember.create({
        data: { tripId: trip.id, userId: user.id, addedById: user.id },
      });
    } catch (error) {
      // P2002 — пришёл дважды из двух вкладок сразу. Второй участник не нужен,
      // а показывать ошибку не за что: человек уже там, куда шёл.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
    }
  }

  // Обновляется не только поездка: у пришедшего изменился список поездок, а он
  // лежит на главной.
  revalidatePath("/", "layout");
  redirect(`/trips/${trip.id}`);
}
