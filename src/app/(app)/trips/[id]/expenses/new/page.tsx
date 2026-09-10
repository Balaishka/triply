import { notFound, redirect } from "next/navigation";

import { ExpenseForm } from "@/components/expenses/expense-form";
import { BackLink } from "@/components/ui/back-link";
import { createExpenseAction } from "@/lib/actions/expenses";
import { requireUser } from "@/lib/auth/require-user";
import { getTripDetail } from "@/lib/queries/trips";

export default async function NewExpensePage({ params }: PageProps<"/trips/[id]/expenses/new">) {
  const { id } = await params;
  const user = await requireUser();
  const trip = await getTripDetail(id, user.id);
  if (!trip) notFound();
  if (trip.status === "COMPLETED") redirect(`/trips/${id}`);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <BackLink href={`/trips/${trip.id}`}>{trip.name}</BackLink>
        <h1 className="text-2xl font-extrabold tracking-tight">Новый расход</h1>
      </div>
      <ExpenseForm
        action={createExpenseAction.bind(null, trip.id)}
        members={trip.members}
        currency={trip.currency}
        submitLabel="Добавить"
        pendingLabel="Добавляем…"
      />
    </div>
  );
}
