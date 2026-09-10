import { prisma } from "@/lib/db";

export interface FriendSummary {
  friendshipId: string;
  userId: string;
  nickname: string;
  avatar: string | null;
}

const userFields = { id: true, nickname: true, avatar: true } as const;

/** Подтверждённые друзья пользователя — в обе стороны, кто бы ни был инициатором. */
export async function getFriends(userId: string): Promise<FriendSummary[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: {
      id: true,
      requester: { select: userFields },
      addressee: { select: userFields },
    },
  });

  return friendships
    .map(({ id, requester, addressee }) => {
      const friend = requester.id === userId ? addressee : requester;
      return {
        friendshipId: id,
        userId: friend.id,
        nickname: friend.nickname,
        avatar: friend.avatar,
      };
    })
    .sort((a, b) => a.nickname.localeCompare(b.nickname, "ru"));
}

/** Идентификаторы друзей — для проверки «можно ли добавить в поездку». */
export async function getFriendIds(userId: string): Promise<Set<string>> {
  const friends = await getFriends(userId);
  return new Set(friends.map((friend) => friend.userId));
}

/** Заявки, ждущие ответа этого пользователя. */
export async function getIncomingRequests(userId: string): Promise<FriendSummary[]> {
  const requests = await prisma.friendship.findMany({
    where: { addresseeId: userId, status: "PENDING" },
    select: { id: true, requester: { select: userFields } },
    orderBy: { createdAt: "desc" },
  });

  return requests.map(({ id, requester }) => ({
    friendshipId: id,
    userId: requester.id,
    nickname: requester.nickname,
    avatar: requester.avatar,
  }));
}

/**
 * Сколько заявок ждёт ответа — для отметки на вкладке «Друзья».
 *
 * Отдельный счётчик, а не длина `getIncomingRequests`: он нужен в каркасе на
 * каждой странице, и тянуть ради одной цифры ники с аватарками незачем.
 */
export function countIncomingRequests(userId: string): Promise<number> {
  return prisma.friendship.count({ where: { addresseeId: userId, status: "PENDING" } });
}

/** Заявки, отправленные этим пользователем и ещё не принятые. */
export async function getOutgoingRequests(userId: string): Promise<FriendSummary[]> {
  const requests = await prisma.friendship.findMany({
    where: { requesterId: userId, status: "PENDING" },
    select: { id: true, addressee: { select: userFields } },
    orderBy: { createdAt: "desc" },
  });

  return requests.map(({ id, addressee }) => ({
    friendshipId: id,
    userId: addressee.id,
    nickname: addressee.nickname,
    avatar: addressee.avatar,
  }));
}

export type SearchResultStatus = "none" | "friends" | "incoming" | "outgoing";

export interface SearchResult {
  userId: string;
  nickname: string;
  avatar: string | null;
  status: SearchResultStatus;
}

/**
 * Поиск людей по нику или почте.
 *
 * По нику ищем по вхождению — так находят «того самого Диму». По почте только
 * точное совпадение: иначе поиск превращается в способ подбирать чужие адреса
 * по кусочкам.
 */
export async function searchUsers(query: string, currentUserId: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { not: currentUserId },
      OR: [
        { nickname: { contains: trimmed, mode: "insensitive" } },
        { email: trimmed.toLowerCase() },
      ],
    },
    select: userFields,
    take: 20,
    orderBy: { nickname: "asc" },
  });

  if (users.length === 0) return [];

  const relations = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: currentUserId, addresseeId: { in: users.map((u) => u.id) } },
        { addresseeId: currentUserId, requesterId: { in: users.map((u) => u.id) } },
      ],
    },
    select: { requesterId: true, addresseeId: true, status: true },
  });

  const statusByUser = new Map<string, SearchResultStatus>();
  for (const relation of relations) {
    const otherId =
      relation.requesterId === currentUserId ? relation.addresseeId : relation.requesterId;
    if (relation.status === "ACCEPTED") {
      statusByUser.set(otherId, "friends");
    } else {
      statusByUser.set(otherId, relation.requesterId === currentUserId ? "outgoing" : "incoming");
    }
  }

  return users.map((user) => ({
    userId: user.id,
    nickname: user.nickname,
    avatar: user.avatar,
    status: statusByUser.get(user.id) ?? "none",
  }));
}
