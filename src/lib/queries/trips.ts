import { prisma } from "@/lib/db";
import {
  computeBalances,
  simplifyTransfers,
  totalSpent,
  type Balance,
  type Transfer,
} from "@/lib/settlement";

export interface TripMemberView {
  id: string;
  userId: string | null;
  name: string;
  avatar: string | null;
  isGuest: boolean;
  isMe: boolean;
}

export interface ExpenseView {
  id: string;
  title: string;
  amountMinor: number;
  spentAt: Date;
  paidByMemberId: string;
  splitMode: "EQUAL" | "MANUAL";
  shares: { memberId: string; amountMinor: number }[];
}

export interface SettlementView {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}

export interface TripDetail {
  id: string;
  name: string;
  currency: string;
  startDate: Date | null;
  endDate: Date | null;
  status: "ACTIVE" | "COMPLETED";
  createdById: string;
  isCreator: boolean;
  /** Участник поездки, соответствующий текущему пользователю. */
  myMemberId: string | null;
  members: TripMemberView[];
  expenses: ExpenseView[];
  settlements: SettlementView[];
}

export interface TripListItem {
  id: string;
  name: string;
  currency: string;
  startDate: Date | null;
  endDate: Date | null;
  status: "ACTIVE" | "COMPLETED";
  memberCount: number;
  totalMinor: number;
  /** Итог текущего пользователя: больше нуля — ему должны, меньше — должен он. */
  myNetMinor: number;
}

const memberSelect = {
  id: true,
  userId: true,
  guestName: true,
  user: { select: { nickname: true, avatar: true } },
} as const;

/** Имя участника: ник аккаунта либо имя гостя. */
export function memberName(member: {
  guestName: string | null;
  user: { nickname: string } | null;
}): string {
  return member.user?.nickname ?? member.guestName ?? "Без имени";
}

/**
 * Поездки пользователя со сводкой для карточки списка.
 *
 * Расходы грузятся целиком, а не агрегатом: чтобы показать «вы должны 1 200 ₽»,
 * всё равно нужны доли по каждому участнику. На масштабе дружеских поездок
 * (десятки расходов) это дешевле, чем несколько отдельных запросов.
 */
export async function getTripsForUser(userId: string): Promise<TripListItem[]> {
  const trips = await prisma.trip.findMany({
    where: { members: { some: { userId } } },
    select: {
      id: true,
      name: true,
      currency: true,
      startDate: true,
      endDate: true,
      status: true,
      createdAt: true,
      members: { select: { id: true, userId: true } },
      expenses: {
        select: {
          amountMinor: true,
          paidByMemberId: true,
          shares: { select: { memberId: true, amountMinor: true } },
        },
      },
      settlements: { select: { fromMemberId: true, toMemberId: true, amountMinor: true } },
    },
    orderBy: [{ status: "asc" }, { startDate: "desc" }, { createdAt: "desc" }],
  });

  return trips.map((trip) => {
    const memberIds = trip.members.map((member) => member.id);
    const balances = computeBalances(memberIds, trip.expenses, trip.settlements);
    const myMemberId = trip.members.find((member) => member.userId === userId)?.id;

    return {
      id: trip.id,
      name: trip.name,
      currency: trip.currency,
      startDate: trip.startDate,
      endDate: trip.endDate,
      status: trip.status,
      memberCount: trip.members.length,
      totalMinor: totalSpent(trip.expenses),
      myNetMinor: balances.find((balance) => balance.memberId === myMemberId)?.netMinor ?? 0,
    };
  });
}

/**
 * Полные данные поездки — или `null`, если пользователь в ней не состоит.
 *
 * Один и тот же `null` на «нет такой поездки» и «вы не участник»: страница
 * показывает 404 в обоих случаях и не подтверждает существование чужих поездок.
 */
export async function getTripDetail(tripId: string, userId: string): Promise<TripDetail | null> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      name: true,
      currency: true,
      startDate: true,
      endDate: true,
      status: true,
      createdById: true,
      members: { select: memberSelect, orderBy: { createdAt: "asc" } },
      expenses: {
        select: {
          id: true,
          title: true,
          amountMinor: true,
          spentAt: true,
          paidByMemberId: true,
          splitMode: true,
          shares: { select: { memberId: true, amountMinor: true } },
        },
        orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
      },
      settlements: {
        select: { id: true, fromMemberId: true, toMemberId: true, amountMinor: true },
      },
    },
  });

  if (!trip) return null;

  const myMember = trip.members.find((member) => member.userId === userId);
  if (!myMember) return null;

  return {
    id: trip.id,
    name: trip.name,
    currency: trip.currency,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    createdById: trip.createdById,
    isCreator: trip.createdById === userId,
    myMemberId: myMember.id,
    members: trip.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      name: memberName(member),
      avatar: member.user?.avatar ?? null,
      isGuest: member.userId === null,
      isMe: member.id === myMember.id,
    })),
    expenses: trip.expenses,
    settlements: trip.settlements,
  };
}

export interface TripSummary {
  totalMinor: number;
  balances: Balance[];
  transfers: Transfer[];
}

/** Сводка поездки: общая сумма, балансы участников и итоговые переводы. */
export function buildSummary(trip: TripDetail): TripSummary {
  const balances = computeBalances(
    trip.members.map((member) => member.id),
    trip.expenses,
    trip.settlements,
  );

  return {
    totalMinor: totalSpent(trip.expenses),
    balances,
    transfers: simplifyTransfers(balances),
  };
}
