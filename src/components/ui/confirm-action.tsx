"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/actions/form-state";

/**
 * Необратимое действие с подтверждением на месте.
 *
 * Вместо системного `confirm()`, который на телефоне выглядит чужеродно и
 * блокирует страницу: первый клик разворачивает вопрос прямо в потоке, второй
 * выполняет. Отменить можно, просто нажав «Отмена» — ничего не улетает по
 * случайному касанию.
 */
export function ConfirmAction({
  label,
  question,
  confirmLabel,
  action,
  variant = "destructive",
}: {
  label: string;
  question: string;
  confirmLabel: string;
  action: () => Promise<FormState>;
  variant?: "destructive" | "outline";
}) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!armed) {
    return (
      <div className="flex flex-col gap-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="button" variant={variant} onClick={() => setArmed(true)}>
          {label}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-sm font-semibold text-foreground">{question}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await action();
              // Успешное действие уводит со страницы или обновляет её само,
              // поэтому сюда мы возвращаемся только с ошибкой.
              if (result?.error) {
                setError(result.error);
                setArmed(false);
              }
            })
          }
        >
          {pending ? "Удаляем…" : confirmLabel}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => setArmed(false)}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
