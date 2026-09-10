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

export function RemoveFriendshipButton({
  friendshipId,
  label,
}: {
  friendshipId: string;
  label: string;
}) {
  return (
    <ActionButton
      label={label}
      pendingLabel="…"
      variant="ghost"
      action={removeFriendshipAction.bind(null, friendshipId)}
    />
  );
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
