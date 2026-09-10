import type { Metadata } from "next";

import {
  AcceptRequestButton,
  RemoveFriendshipButton,
  SendRequestButton,
} from "@/components/friends/friend-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { requireUser } from "@/lib/auth/require-user";
import {
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  searchUsers,
  type SearchResultStatus,
} from "@/lib/queries/friends";

export const metadata: Metadata = { title: "Друзья — Triply" };

export default async function FriendsPage({ searchParams }: PageProps<"/friends">) {
  const user = await requireUser();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";

  const [friends, incoming, outgoing, results] = await Promise.all([
    getFriends(user.id),
    getIncomingRequests(user.id),
    getOutgoingRequests(user.id),
    query ? searchUsers(query, user.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Друзья</h1>

      {/* Поиск через обычную форму: результат живёт в адресе, им можно поделиться
          и вернуться назад кнопкой браузера. */}
      <form method="get" className="flex gap-2">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Никнейм или почта"
          aria-label="Поиск людей"
          className="flex-1"
        />
        <Button type="submit" variant="outline">
          Найти
        </Button>
      </form>

      {query && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Результаты поиска
          </h2>
          {results.length === 0 ? (
            <p className="rounded-xl border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
              Никого не нашли. По никнейму ищем по части слова, по почте — только точное совпадение.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {results.map((result, index) => (
                <PersonRow
                  key={result.userId}
                  name={result.nickname}
                  avatar={result.avatar}
                  withBorder={index > 0}
                  note={statusNote(result.status)}
                  action={
                    result.status === "none" ? <SendRequestButton userId={result.userId} /> : null
                  }
                />
              ))}
            </div>
          )}
        </section>
      )}

      {incoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Заявки к вам
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {incoming.map((request, index) => (
              <PersonRow
                key={request.friendshipId}
                name={request.nickname}
                avatar={request.avatar}
                withBorder={index > 0}
                action={
                  <div className="flex items-center gap-1">
                    <AcceptRequestButton friendshipId={request.friendshipId} />
                    <RemoveFriendshipButton
                      friendshipId={request.friendshipId}
                      label="Отклонить"
                    />
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Вы отправили
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {outgoing.map((request, index) => (
              <PersonRow
                key={request.friendshipId}
                name={request.nickname}
                avatar={request.avatar}
                withBorder={index > 0}
                note="Ждём ответа"
                action={
                  <RemoveFriendshipButton friendshipId={request.friendshipId} label="Отменить" />
                }
              />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Ваши друзья
        </h2>
        {friends.length === 0 ? (
          <EmptyState
            title="Пока никого"
            description="Найдите друзей по никнейму или почте — потом их можно будет добавлять в поездки."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {friends.map((friend, index) => (
              <PersonRow
                key={friend.friendshipId}
                name={friend.nickname}
                avatar={friend.avatar}
                withBorder={index > 0}
                action={
                  <RemoveFriendshipButton friendshipId={friend.friendshipId} label="Удалить" />
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PersonRow({
  name,
  avatar,
  note,
  action,
  withBorder,
}: {
  name: string;
  avatar: string | null;
  note?: string | null;
  action?: React.ReactNode;
  withBorder: boolean;
}) {
  return (
    <div
      className={"flex items-center gap-3 px-4 py-3" + (withBorder ? " border-t border-border" : "")}
    >
      <Avatar name={name} avatar={avatar} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>
      {action}
    </div>
  );
}

function statusNote(status: SearchResultStatus): string | null {
  if (status === "friends") return "Уже в друзьях";
  if (status === "outgoing") return "Заявка отправлена";
  if (status === "incoming") return "Ждёт вашего ответа — заявка ниже";
  return null;
}
