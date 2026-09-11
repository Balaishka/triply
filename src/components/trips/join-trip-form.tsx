"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { joinTripAction } from "@/lib/actions/invites";

/** Место гостя, которое можно объявить своим. */
export interface FreeGuest {
  memberId: string;
  name: string;
}

const NEW_MEMBER = "";

/**
 * Согласие на вступление в поездку.
 *
 * Отдельная кнопка, а не вступление самим переходом по ссылке: по ссылкам
 * ходят почтовые клиенты и превью в мессенджерах, и поездка пополнялась бы
 * участниками, которые её даже не открывали.
 */
export function JoinTripForm({
  token,
  tripName,
  guests,
}: {
  token: string;
  tripName: string;
  guests: FreeGuest[];
}) {
  const [choice, setChoice] = useState(NEW_MEMBER);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Список гостей — для тех, кого в поездке уже завели по имени и записали
          на них расходы. Занять такое место важнее, чем прийти новым: иначе в
          поездке окажется два одинаковых человека и долги разойдутся надвое. */}
      {guests.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Вы кто-то из них?</legend>

          {guests.map((guest) => (
            <ChoiceRow
              key={guest.memberId}
              checked={choice === guest.memberId}
              onSelect={() => setChoice(guest.memberId)}
              title={`Я — ${guest.name}`}
              note="Всё, что уже записано на это имя, станет вашим"
            />
          ))}

          <ChoiceRow
            checked={choice === NEW_MEMBER}
            onSelect={() => setChoice(NEW_MEMBER)}
            title="Меня здесь ещё нет"
            note="Появитесь в поездке новым участником"
          />
        </fieldset>
      )}

      <Button
        type="button"
        size="lg"
        variant="accent"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await joinTripAction(token, choice === NEW_MEMBER ? null : choice);
            // При успехе действие уводит в поездку, так что сюда мы
            // возвращаемся только с отказом.
            setError(result?.error ?? null);
          })
        }
      >
        {pending ? "Присоединяемся…" : `Присоединиться к «${tripName}»`}
      </Button>
    </div>
  );
}

function ChoiceRow({
  checked,
  onSelect,
  title,
  note,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  note: string;
}) {
  return (
    <label
      className={
        "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors " +
        (checked ? "border-primary bg-muted" : "border-border bg-card hover:bg-muted/50")
      }
    >
      <input
        type="radio"
        name="who"
        checked={checked}
        onChange={onSelect}
        className="mt-1 size-4 accent-primary"
      />
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{note}</span>
      </span>
    </label>
  );
}
