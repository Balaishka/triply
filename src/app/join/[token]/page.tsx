import type { Metadata } from "next";
import type { ReactNode } from "react";

import { JoinTripForm } from "@/components/trips/join-trip-form";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/link-button";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/dates";
import { plural } from "@/lib/plural";
import { findInvite, type InviteView } from "@/lib/queries/invites";
import { inviteOutcome, invitePath } from "@/lib/trips/invite-link";

export const metadata: Metadata = { title: "Приглашение в поездку — Triply" };

/**
 * Страница вне групп `(app)` и `(auth)`.
 *
 * Ссылку открывает кто угодно: и вошедший, для которого `(auth)` развернул бы
 * страницу на главную, и человек без аккаунта, которого `(app)` выставил бы на
 * вход — и приглашение по дороге потерялось бы. Поэтому вход и регистрация
 * отсюда уходят с адресом возврата, а сама поездка показывается до всякой
 * сессии: без названия и компании непонятно, куда вообще зовут.
 */
export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;

  const user = await getCurrentUser();
  const invite = await findInvite(token, user?.id ?? null);
  const outcome = inviteOutcome(invite);

  if (!invite || outcome === "broken") {
    return (
      <Notice title="Ссылка не работает">
        <p className="text-sm text-muted-foreground">
          Её отозвали, заменили новой — или поездки больше нет. Попросите того, кто вас позвал,
          прислать ссылку заново.
        </p>
        <LinkButton href="/" className="mx-auto">
          На главную
        </LinkButton>
      </Notice>
    );
  }

  if (outcome === "member") {
    return (
      <Notice title="Вы уже в этой поездке">
        <TripPreview invite={invite} />
        <LinkButton href={`/trips/${invite.tripId}`} className="mx-auto">
          Открыть поездку
        </LinkButton>
      </Notice>
    );
  }

  if (outcome === "completed") {
    return (
      <Notice title="Поездка уже завершена">
        <TripPreview invite={invite} />
        <p className="text-sm text-muted-foreground">
          Присоединяться к ней поздно: расходы в завершённой поездке уже посчитаны. Если это
          ошибка, участники могут открыть её заново.
        </p>
      </Notice>
    );
  }

  const returnTo = invitePath(token);

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 text-center">
        <p className="text-sm font-semibold text-muted-foreground">Вас зовут в поездку</p>
        <TripPreview invite={invite} />
      </div>

      {user ? (
        <JoinTripForm token={token} tripName={invite.tripName} guests={invite.freeGuests} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-center text-sm text-muted-foreground">
            Чтобы вести расходы вместе, нужен аккаунт. Это минута — и вы сразу окажетесь в
            поездке.
          </p>
          <LinkButton href={`/register?next=${encodeURIComponent(returnTo)}`} variant="accent">
            Создать аккаунт
          </LinkButton>
          <LinkButton href={`/login?next=${encodeURIComponent(returnTo)}`} variant="outline">
            У меня уже есть аккаунт
          </LinkButton>
        </div>
      )}
    </div>
  );
}

/** Название, даты и компания: по ним человек и понимает, та ли это поездка. */
function TripPreview({ invite }: { invite: InviteView }) {
  const dates = formatDateRange(invite.startDate, invite.endDate);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-xl font-extrabold tracking-tight">{invite.tripName}</p>
        <p className="text-sm text-muted-foreground">
          {dates ? `${dates} · ` : ""}
          {invite.members.length}{" "}
          {plural(invite.members.length, "участник", "участника", "участников")}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {invite.members.map((member) => (
          <span
            key={member.id}
            className="flex items-center gap-2 rounded-full bg-muted py-1 pl-1 pr-3"
          >
            <Avatar name={member.name} avatar={member.avatar} size="sm" />
            <span className="text-sm font-semibold">{member.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Тупик: объяснение и один выход. */
function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      {children}
    </div>
  );
}
