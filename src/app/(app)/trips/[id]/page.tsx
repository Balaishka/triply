import Link from "next/link";
import { notFound } from "next/navigation";

import { Money } from "@/components/money";
import { TripHeader } from "@/components/trips/trip-header";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { requireUser } from "@/lib/auth/require-user";
import { formatDayHeading } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { buildSummary, getTripDetail, type ExpenseView, type TripDetail } from "@/lib/queries/trips";

export default async function TripPage({ params }: PageProps<"/trips/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const trip = await getTripDetail(id, user.id);
  if (!trip) notFound();

  const summary = buildSummary(trip);
  const myBalance = summary.balances.find((balance) => balance.memberId === trip.myMemberId);
  const byDay = groupByDay(trip.expenses);

  return (
    <div className="flex flex-col gap-5">
      <TripHeader trip={trip} />

      <section className="flex items-center justify-between gap-4 rounded-xl bg-primary px-4 py-3 text-primary-foreground">
        <div>
          <p className="text-xs opacity-80">{balanceLabel(myBalance?.netMinor ?? 0)}</p>
          <p className="tabular text-xl font-extrabold">
            {formatMoney(Math.abs(myBalance?.netMinor ?? 0), trip.currency)}
          </p>
        </div>
        <Link
          href={`/trips/${trip.id}/summary`}
          className="rounded-lg bg-primary-foreground/15 px-3 py-2 text-sm font-semibold hover:bg-primary-foreground/25"
        >
          Итоги
        </Link>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Участники
          </h2>
          <Link
            href={`/trips/${trip.id}/settings`}
            className="text-sm font-semibold text-primary underline underline-offset-2"
          >
            Изменить
          </Link>
        </div>
        <div className="flex flex-wrap gap-3">
          {trip.members.map((member) => (
            <div key={member.id} className="flex items-center gap-2 rounded-full bg-muted py-1 pl-1 pr-3">
              <Avatar name={member.name} avatar={member.avatar} size="sm" />
              <span className="text-sm font-semibold">
                {member.isMe ? "Вы" : member.name}
                {member.isGuest && <span className="text-muted-foreground"> · гость</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Расходы</h2>

        {trip.expenses.length === 0 ? (
          <EmptyState
            title="Расходов пока нет"
            description="Добавьте первый — Triply сам разделит его между участниками."
            action={
              trip.status === "ACTIVE" ? (
                <LinkButton href={`/trips/${trip.id}/expenses/new`} variant="accent">
                  Добавить расход
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          byDay.map(([day, expenses]) => (
            <div key={day} className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted-foreground">
                {formatDayHeading(new Date(day))}
              </p>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                {expenses.map((expense, index) => (
                  <ExpenseRow
                    key={expense.id}
                    trip={trip}
                    expense={expense}
                    withBorder={index > 0}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {trip.status === "ACTIVE" && trip.expenses.length > 0 && (
        <Link
          href={`/trips/${trip.id}/expenses/new`}
          className="fixed bottom-20 right-4 z-10 inline-flex h-14 items-center gap-2 rounded-full bg-accent px-5 font-bold text-accent-foreground shadow-lg sm:bottom-8"
        >
          <span className="text-xl leading-none">+</span>
          Расход
        </Link>
      )}
    </div>
  );
}

function ExpenseRow({
  trip,
  expense,
  withBorder,
}: {
  trip: TripDetail;
  expense: ExpenseView;
  withBorder: boolean;
}) {
  const payer = trip.members.find((member) => member.id === expense.paidByMemberId);
  const myShare = expense.shares.find((share) => share.memberId === trip.myMemberId);

  return (
    <Link
      href={`/trips/${trip.id}/expenses/${expense.id}`}
      className={`flex items-center gap-3 px-4 py-3 hover:bg-muted ${withBorder ? "border-t border-border" : ""}`}
    >
      <Avatar name={payer?.name ?? "?"} avatar={payer?.avatar} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{expense.title}</p>
        <p className="text-sm text-muted-foreground">
          {payer?.isMe ? "Платили вы" : `Платил(а) ${payer?.name ?? "?"}`}
        </p>
      </div>
      <div className="text-right">
        <Money amountMinor={expense.amountMinor} currency={trip.currency} />
        <p className="tabular text-xs text-muted-foreground">
          {myShare
            ? `ваша доля ${formatMoney(myShare.amountMinor, trip.currency)}`
            : "вас нет в расходе"}
        </p>
      </div>
    </Link>
  );
}

/** Расходы по дням, свежие сверху. */
function groupByDay(expenses: ExpenseView[]): Array<[string, ExpenseView[]]> {
  const groups = new Map<string, ExpenseView[]>();

  for (const expense of expenses) {
    const day = expense.spentAt.toISOString().slice(0, 10);
    const group = groups.get(day);
    if (group) {
      group.push(expense);
    } else {
      groups.set(day, [expense]);
    }
  }

  return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function balanceLabel(netMinor: number): string {
  if (netMinor > 0) return "Вам должны";
  if (netMinor < 0) return "Вы должны";
  return "Вы в расчёте";
}

