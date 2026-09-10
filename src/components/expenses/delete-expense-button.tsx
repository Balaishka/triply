"use client";

import { ConfirmAction } from "@/components/ui/confirm-action";
import { deleteExpenseAction } from "@/lib/actions/expenses";

export function DeleteExpenseButton({
  tripId,
  expenseId,
  title,
}: {
  tripId: string;
  expenseId: string;
  title: string;
}) {
  return (
    <ConfirmAction
      label="Удалить расход"
      question={`Удалить «${title}»? Доли участников пересчитаются.`}
      confirmLabel="Удалить"
      action={deleteExpenseAction.bind(null, tripId, expenseId)}
    />
  );
}
