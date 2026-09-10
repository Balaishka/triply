"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  acceptFriendRequestAction,
  removeFriendshipAction,
  sendFriendRequestAction,
} from "@/lib/actions/friends";
import type { FormState } from "@/lib/actions/form-state";

/** Кнопка, выполняющая серверное действие и показывающая его ошибку рядом. */
function ActionButton({
  label,
  pendingLabel,
  action,
  variant = "outline",
  size = "sm",
}: {
  label: string;
  pendingLabel: string;
  action: () => Promise<FormState>;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await action();
            setError(result?.error ?? null);
          })
        }
      >
        {pending ? pendingLabel : label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * То же действие, но в два касания: первое разворачивает выбор «подтвердить или
 * отменить» прямо в строке списка. Правило то же, что у `ConfirmAction`, только
 * без вопроса отдельной строкой — в узкую строку с именем он не влезает.
 */
function ConfirmingActionButton({
  label,
  confirmLabel,
  action,
}: {
  label: string;
  confirmLabel: string;
  action: () => Promise<FormState>;
}) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      {armed ? (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await action();
                // При успехе строка исчезает вместе с кнопкой, так что сюда мы
                // возвращаемся только с ошибкой.
                if (result?.error) {
                  setError(result.error);
                  setArmed(false);
                }
              })
            }
          >
            {pending ? "…" : confirmLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setArmed(false)}
          >
            Отмена
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="ghost" onClick={() => setArmed(true)}>
          {label}
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function AcceptRequestButton({ friendshipId }: { friendshipId: string }) {
  return (
    <ActionButton
      label="Принять"
      pendingLabel="…"
      variant="primary"
      action={acceptFriendRequestAction.bind(null, friendshipId)}
    />
  );
}

/**
 * Разрыв дружбы и отказ от заявки — одно действие, но подтверждения стоят
 * разной цены: заявку легко отправить заново, а вычеркнутого друга придётся
 * искать и ждать его ответа. Поэтому `confirm` включается только на списке
 * друзей.
 */
export function RemoveFriendshipButton({
  friendshipId,
  label,
  confirm = false,
}: {
  friendshipId: string;
  label: string;
  confirm?: boolean;
}) {
  const action = removeFriendshipAction.bind(null, friendshipId);

  if (confirm) {
    return <ConfirmingActionButton label={label} confirmLabel={label} action={action} />;
  }

  return <ActionButton label={label} pendingLabel="…" variant="ghost" action={action} />;
}

export function SendRequestButton({ userId }: { userId: string }) {
  return (
    <ActionButton
      label="Добавить"
      pendingLabel="…"
      variant="primary"
      action={sendFriendRequestAction.bind(null, userId)}
    />
  );
}
