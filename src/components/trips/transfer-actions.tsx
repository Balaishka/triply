"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { markTransferPaidAction, unmarkTransferAction } from "@/lib/actions/settlements";

/**
 * Отметка «перевёл».
 *
 * Отмеченный перевод уменьшает остаток долга, поэтому строка просто исчезает из
 * списка «осталось перевести» и появляется в «уже переведено». Для человека это
 * одна галочка, для расчёта — обычная операция, которая сходится с остальными.
 */
export function MarkPaidButton({
  tripId,
  fromMemberId,
  toMemberId,
  amountMinor,
}: {
  tripId: string;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await markTransferPaidAction(
              tripId,
              fromMemberId,
              toMemberId,
              amountMinor,
            );
            setError(result?.error ?? null);
          })
        }
      >
        {pending ? "Отмечаем…" : "Переведено"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function UndoTransferButton({
  tripId,
  settlementId,
}: {
  tripId: string;
  settlementId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await unmarkTransferAction(tripId, settlementId);
            setError(result?.error ?? null);
          })
        }
        className="text-sm font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
      >
        {pending ? "Отменяем…" : "Отменить"}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
