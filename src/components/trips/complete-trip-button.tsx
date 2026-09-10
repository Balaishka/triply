"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { completeTripAction, reopenTripAction } from "@/lib/actions/trips";

/**
 * Завершение поездки и возврат к редактированию.
 *
 * Завершение не окончательно: поездку всегда можно открыть заново. Поэтому
 * подтверждение здесь не нужно — цена ошибки один клик.
 */
export function CompleteTripButton({
  tripId,
  status,
}: {
  tripId: string;
  status: "ACTIVE" | "COMPLETED";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const completed = status === "COMPLETED";

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-5">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        size="lg"
        variant={completed ? "outline" : "primary"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = completed
              ? await reopenTripAction(tripId)
              : await completeTripAction(tripId);
            setError(result?.error ?? null);
          })
        }
      >
        {pending
          ? "Секунду…"
          : completed
            ? "Открыть поездку заново"
            : "Завершить поездку"}
      </Button>

      <p className="text-sm text-muted-foreground">
        {completed
          ? "Поездка закрыта на изменения. Отметки о переводах при этом работают."
          : "После завершения расходы больше не редактируются, но отметить переводы всё ещё можно."}
      </p>
    </section>
  );
}
