import { notFound, redirect } from "next/navigation";

import { DeleteExpenseButton } from "@/components/expenses/delete-expense-button";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { updateExpenseAction } from "@/lib/actions/expenses";
import { requireUser } from "@/lib/auth/require-user";
import { toISODate } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { getTripDetail } from "@/lib/queries/trips";

export default async function EditExpensePage({
  params,
}: PageProps<"/trips/[id]/expenses/[expenseId]">) {
  const { id, expenseId } = await params;
  const user = await requireUser();
  const trip = await getTripDetail(id, user.id);
  if (!trip) notFound();

  const expense = trip.expenses.find((item) => item.id === expenseId);
  if (!expense) notFound();

  // Завершённую поездку не редактируют — показывать форму бессмысленно.
  if (trip.status === "COMPLETED") redirect(`/trips/${id}`);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Расход</h1>

      <ExpenseForm
        action={updateExpenseAction.bind(null, trip.id, expense.id)}
        members={trip.members}
        currency={trip.currency}
        initial={{
          title: expense.title,
          amountText: formatAmount(expense.amountMinor, trip.currency),
          spentAt: toISODate(expense.spentAt),
          paidByMemberId: expense.paidByMemberId,
          shares: expense.shares,
          splitMode: expense.splitMode,
        }}
        submitLabel="Сохранить"
        pendingLabel="Сохраняем…"
      />

      <DeleteExpenseButton tripId={trip.id} expenseId={expense.id} title={expense.title} />
    </div>
  );
}
