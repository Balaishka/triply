import { appUrl } from "@/lib/app-url";
import { prisma } from "@/lib/db";
import { memberName } from "@/lib/queries/trips";
import { invitePath } from "@/lib/trips/invite-link";

/**
 * Ссылка-приглашение поездки или `null`, если её ещё не создали.
 *
 * Адрес собирается абсолютным: ссылку копируют и отправляют в чат, а там
 * относительный путь никуда не ведёт.
 */
export async function getTripInviteUrl(tripId: string): Promise<string | null> {
  const invite = await prisma.tripInvite.findUnique({
    where: { tripId },
    select: { token: true },
  });

  return invite ? appUrl(invitePath(invite.token)) : null;
}

export interface InviteMemberView {
  id: string;
  name: string;
  avatar: string | null;
  isGuest: boolean;
}

export interface InviteView {
  tripId: string;
  tripName: string;
  tripStatus: "ACTIVE" | "COMPLETED";
  startDate: Date | null;
  endDate: Date | null;
  /** Кто уже в поездке — по компании и понятно, та ли это ссылка. */
  members: InviteMemberView[];
  viewerIsMember: boolean;
  /**
   * Гости без аккаунта: пришедший по ссылке может занять место одного из них
   * вместо того, чтобы заводиться отдельным участником.
   */
  freeGuests: { memberId: string; name: string }[];
}

/**
 * Поездка по токену приглашения — или `null`, если такой ссылки нет.
 *
 * Названия и состава участников достаточно, чтобы человек понял, куда его
 * позвали; расходы и суммы здесь не нужны — до вступления они не его дело.
 */
export async function findInvite(token: string, viewerId: string | null): Promise<InviteView | null> {
  const invite = await prisma.tripInvite.findUnique({
    where: { token },
    select: {
      trip: {
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          members: {
            select: {
              id: true,
              userId: true,
              guestName: true,
              user: { select: { nickname: true, avatar: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!invite) return null;

  const { trip } = invite;

  return {
    tripId: trip.id,
    tripName: trip.name,
    tripStatus: trip.status,
    startDate: trip.startDate,
    endDate: trip.endDate,
    members: trip.members.map((member) => ({
      id: member.id,
      name: memberName(member),
      avatar: member.user?.avatar ?? null,
      isGuest: member.userId === null,
    })),
    viewerIsMember: viewerId !== null && trip.members.some((member) => member.userId === viewerId),
    freeGuests: trip.members
      .filter((member) => member.userId === null)
      .map((member) => ({ memberId: member.id, name: memberName(member) })),
  };
}
