"use client";

import { useActionState, useState, useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import {
  addFriendToTripAction,
  addGuestToTripAction,
  linkGuestToUserAction,
  removeTripMemberAction,
} from "@/lib/actions/trips";
import type { FriendSummary } from "@/lib/queries/friends";
import type { TripMemberView } from "@/lib/queries/trips";

export function MembersManager({
  tripId,
  members,
  availableFriends,
  canEdit,
}: {
  tripId: string;
  members: TripMemberView[];
  /** Друзья, которых ещё нет в поездке. */
  availableFriends: FriendSummary[];
  canEdit: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Участники</h2>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {members.map((member, index) => (
          <div
            key={member.id}
            className={
              "flex items-center gap-3 px-4 py-3" + (index > 0 ? " border-t border-border" : "")
            }
          >
            <Avatar name={member.name} src={member.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{member.isMe ? "Вы" : member.name}</p>
              {member.isGuest && (
                <p className="text-sm text-muted-foreground">Гость — без аккаунта</p>
              )}
            </div>

            {canEdit && !member.isMe && (
              <RemoveMemberButton tripId={tripId} memberId={member.id} onError={setError} />
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <>
          <GuestLinker
            tripId={tripId}
            guests={members.filter((member) => member.isGuest)}
            friends={availableFriends}
            onError={setError}
          />
          <AddFriends tripId={tripId} friends={availableFriends} onError={setError} />
          <AddGuest tripId={tripId} />
        </>
      )}
    </section>
  );
}

function RemoveMemberButton({
  tripId,
  memberId,
  onError,
}: {
  tripId: string;
  memberId: string;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await removeTripMemberAction(tripId, memberId);
          onError(result?.error ?? null);
        })
      }
      className="shrink-0 text-sm font-semibold text-muted-foreground underline underline-offset-2 hover:text-destructive disabled:opacity-50"
    >
      {pending ? "Убираем…" : "Убрать"}
    </button>
  );
}

function AddFriends({
  tripId,
  friends,
  onError,
}: {
  tripId: string;
  friends: FriendSummary[];
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  if (friends.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Все ваши друзья уже в поездке. Кого-то ещё можно добавить гостем — или сначала подружиться.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">Добавить друга</p>
      <div className="flex flex-wrap gap-2">
        {friends.map((friend) => (
          <button
            key={friend.userId}
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await addFriendToTripAction(tripId, friend.userId);
                onError(result?.error ?? null);
              })
            }
            className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Avatar name={friend.nickname} src={friend.avatarUrl} size="sm" />+ {friend.nickname}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddGuest({ tripId }: { tripId: string }) {
  const [state, action, pending] = useActionState(addGuestToTripAction.bind(null, tripId), null);

  return (
    <form action={action} className="flex flex-col gap-2">
      <FormError>{state?.error}</FormError>
      <Field
        label="Добавить гостя"
        htmlFor="guestName"
        error={state?.fieldErrors?.guestName}
        hint="Для тех, у кого нет аккаунта. Позже гостя можно привязать к аккаунту — расходы сохранятся."
      >
        <div className="flex gap-2">
          <Input id="guestName" name="guestName" placeholder="Имя" className="flex-1" />
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "…" : "Добавить"}
          </Button>
        </div>
      </Field>
    </form>
  );
}

/**
 * Превращение гостя в участника с аккаунтом.
 *
 * Расходы ссылаются на участника поездки, а не на пользователя, поэтому вся
 * история гостя переезжает сама — переносить ничего не нужно.
 */
function GuestLinker({
  tripId,
  guests,
  friends,
  onError,
}: {
  tripId: string;
  guests: TripMemberView[];
  friends: FriendSummary[];
  onError: (message: string | null) => void;
}) {
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  if (guests.length === 0 || friends.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-sm font-semibold">Привязать гостя к аккаунту</p>
      {guests.map((guest) => (
        <div key={guest.id} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-sm font-semibold">{guest.name}</span>
          <Select
            aria-label={"Аккаунт для гостя: " + guest.name}
            value={selection[guest.id] ?? ""}
            onChange={(event) =>
              setSelection((current) => ({ ...current, [guest.id]: event.target.value }))
            }
            className="h-9 flex-1 text-sm"
          >
            <option value="">Выберите друга</option>
            {friends.map((friend) => (
              <option key={friend.userId} value={friend.userId}>
                {friend.nickname}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !selection[guest.id]}
            onClick={() =>
              startTransition(async () => {
                const result = await linkGuestToUserAction(
                  tripId,
                  guest.id,
                  selection[guest.id],
                );
                onError(result?.error ?? null);
              })
            }
          >
            Привязать
          </Button>
        </div>
      ))}
    </div>
  );
}
