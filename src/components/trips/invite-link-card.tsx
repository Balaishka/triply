"use client";

import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { createTripInviteAction, revokeTripInviteAction } from "@/lib/actions/invites";

/**
 * Ссылка-приглашение на странице настроек поездки.
 *
 * Ссылка видна всегда, а не показывается один раз при создании: её кидают в чат
 * и просят прислать заново — «выпустите новую» вместо этого ломало бы ссылку у
 * всех, кто ещё не перешёл.
 */
export function InviteLinkCard({
  tripId,
  url,
  tripActive,
}: {
  tripId: string;
  /** Готовая ссылка или `null`, если её ещё не создавали. */
  url: string | null;
  tripActive: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  // В завершённой поездке предлагать ссылку незачем — приходить туда поздно.
  // Но если ссылка осталась с прошлого раза, её показываем: отозвать можно и
  // сейчас, и это единственное место, где это делается.
  if (!tripActive && !url) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Приглашение по ссылке
      </h2>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {url ? (
        <div className="flex flex-col gap-2">
          <CopyRow url={url} />
          <p className="text-sm text-muted-foreground">
            {tripActive
              ? "Кто откроет ссылку, тот войдёт в поездку — дружба для этого не нужна. Если ссылка ушла не туда, отзовите её."
              : "Поездка завершена, и ссылка сейчас никого не впустит. Она заработает снова, если открыть поездку заново."}
          </p>
          <RevokeButton tripId={tripId} onError={setError} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Пригласите тех, кого нет у вас в друзьях: по ссылке человек заведёт аккаунт и сам
            встанет в список участников.
          </p>
          <CreateButton tripId={tripId} onError={setError} />
        </div>
      )}
    </section>
  );
}

/**
 * Поле со ссылкой и кнопка «Скопировать».
 *
 * Поле настоящее и доступно для выделения: буфер обмена в браузере разрешён не
 * везде (старый Safari, страница без https), и тогда ссылку выделяют и копируют
 * руками — для этого при отказе текст сразу подсвечивается.
 */
function CopyRow({ url }: { url: string }) {
  const field = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex gap-2">
      <Input
        ref={field}
        readOnly
        value={url}
        aria-label="Ссылка-приглашение"
        onFocus={(event) => event.currentTarget.select()}
        className="flex-1 text-sm"
      />
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            field.current?.select();
          }
        }}
      >
        {copied ? "Скопировано" : "Скопировать"}
      </Button>
    </div>
  );
}

function CreateButton({
  tripId,
  onError,
}: {
  tripId: string;
  onError: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      className="w-fit"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createTripInviteAction(tripId);
          onError(result?.error ?? null);
        })
      }
    >
      {pending ? "Создаём…" : "Создать ссылку"}
    </Button>
  );
}

/**
 * Отзыв в два касания.
 *
 * Подтверждение здесь не ради необратимости — новую ссылку выпустить несложно,
 * — а ради тех, кто ссылку уже получил и не успел перейти: для них она умрёт.
 */
function RevokeButton({
  tripId,
  onError,
}: {
  tripId: string;
  onError: (message: string | null) => void;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!armed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => setArmed(true)}
      >
        Отозвать ссылку
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await revokeTripInviteAction(tripId);
            onError(result?.error ?? null);
            setArmed(false);
          })
        }
      >
        {pending ? "Отзываем…" : "Да, отозвать"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => setArmed(false)}
      >
        Отмена
      </Button>
    </div>
  );
}
