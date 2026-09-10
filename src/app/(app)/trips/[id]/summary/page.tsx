import Link from "next/link";
import { notFound } from "next/navigation";

import { Money } from "@/components/money";
import { CompleteTripButton } from "@/components/trips/complete-trip-button";
import { MarkPaidButton, UndoTransferButton } from "@/components/trips/transfer-actions";
import { Avatar } from "@/components/ui/avatar";
import { requireUser } from "@/lib/auth/require-user";
import { formatMoney } from "@/lib/money";
import { buildSummary, getTripDetail } from "@/lib/queries/trips";

export default async function TripSummaryPage({ params }: PageProps<"/trips/[id]/summary">) {
  const { id } = await params;
  const user = await requireUser();
  const trip = await getTripDetail(id, user.id);
  if (!trip) notFound();

  const { totalMinor, balances, transfers } = buildSummary(trip);
  const memberById = new Map(trip.members.map((member) => [member.id, member]));
  const name = (memberId: string) => memberById.get(memberId)?.name ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/trips/${trip.id}`}
          className="w-fit text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          ← {trip.name}
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Итоги поездки</h1>
      </div>

      <section className="rounded-xl bg-primary px-4 py-4 text-primary-foreground">
        <p className="text-xs opacity-80">Всего потрачено</p>
        <p className="tabular text-3xl font-extrabold">{formatMoney(totalMinor, trip.currency)}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Кто сколько платил
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {balances.map((balance, index) => {
            const member = memberById.get(balance.memberId);
            return (
              <div
                key={balance.memberId}
                className={
                  "flex items-center gap-3 px-4 py-3" +
                  (index > 0 ? " border-t border-border" : "")
                }
              >
                <Avatar name={member?.name ?? "?"} avatar={member?.avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {member?.isMe ? "Вы" : (member?.name ?? "—")}
                  </p>
                  <p className="tabular text-sm text-muted-foreground">
                    заплатил(а) {formatMoney(balance.paidMinor, trip.currency)} · потратил(а) на себя{" "}
                    {formatMoney(balance.shareMinor, trip.currency)}
                  </p>
                </div>
                <Money amountMinor={balance.netMinor} currency={trip.currency} tone="auto" />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Справа — итог: зелёным то, что человеку должны, оранжевым — то, что должен он.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Кто кому переводит
        </h2>

        {transfers.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-6 text-center">
            <p className="font-semibold">Все в расчёте</p>
            <p className="mt-1 text-sm text-muted-foreground">Переводить никому ничего не нужно.</p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {transfers.map((transfer, index) => (
                <div
                  key={`${transfer.fromMemberId}-${transfer.toMemberId}`}
                  className={
                    "flex items-center gap-3 px-4 py-3" +
                    (index > 0 ? " border-t border-border" : "")
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {name(transfer.fromMemberId)} → {name(transfer.toMemberId)}
                    </p>
                    <Money
                      amountMinor={transfer.amountMinor}
                      currency={trip.currency}
                      className="text-sm"
                    />
                  </div>
                  <MarkPaidButton
                    tripId={trip.id}
                    fromMemberId={transfer.fromMemberId}
                    toMemberId={transfer.toMemberId}
                    amountMinor={transfer.amountMinor}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {transfers.length === 1
                ? "Хватит одного перевода."
                : `Хватит ${transfers.length} переводов вместо расчётов каждого с каждым.`}
            </p>
          </>
        )}
      </section>

      {trip.settlements.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Уже переведено
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {trip.settlements.map((settlement, index) => (
              <div
                key={settlement.id}
                className={
                  "flex items-center gap-3 px-4 py-3" + (index > 0 ? " border-t border-border" : "")
                }
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-muted-foreground">
                    {name(settlement.fromMemberId)} → {name(settlement.toMemberId)}
                  </p>
                  <Money
                    amountMinor={settlement.amountMinor}
                    currency={trip.currency}
                    tone="muted"
                    className="text-sm"
                  />
                </div>
                <UndoTransferButton tripId={trip.id} settlementId={settlement.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      <CompleteTripButton tripId={trip.id} status={trip.status} />
    </div>
  );
}
