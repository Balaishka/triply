import Link from "next/link";

import { Money } from "@/components/money";
import { EmptyState } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { requireUser } from "@/lib/auth/require-user";
import { formatDateRange } from "@/lib/dates";
import { plural } from "@/lib/plural";
import { getTripsForUser, type TripListItem } from "@/lib/queries/trips";

export default async function TripsPage() {
  const user = await requireUser();
  const trips = await getTripsForUser(user.id);

  const active = trips.filter((trip) => trip.status === "ACTIVE");
  const completed = trips.filter((trip) => trip.status === "COMPLETED");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Поездки</h1>
        <LinkButton href="/trips/new" variant="accent" className="hidden sm:inline-flex">
          Новая поездка
        </LinkButton>
      </div>

      {trips.length === 0 ? (
        <EmptyState
          title="Пока ни одной поездки"
          description="Создайте поездку, позовите друзей и записывайте общие траты. Кто кому сколько должен, Triply посчитает сам."
          action={
            <LinkButton href="/trips/new" variant="accent">
              Создать поездку
            </LinkButton>
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <section className="flex flex-col gap-3">
              {active.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </section>
          )}

          {completed.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Завершённые
              </h2>
              {completed.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </section>
          )}
        </>
      )}

      {/* Плавающая кнопка на телефоне: главное действие всегда под большим пальцем. */}
      {trips.length > 0 && (
        <Link
          href="/trips/new"
          className="fixed bottom-20 right-4 z-10 inline-flex h-14 items-center gap-2 rounded-full bg-accent px-5 font-bold text-accent-foreground shadow-lg sm:hidden"
        >
          <span className="text-xl leading-none">+</span>
          Поездка
        </Link>
      )}
    </div>
  );
}

function TripCard({ trip }: { trip: TripListItem }) {
  const dates = formatDateRange(trip.startDate, trip.endDate);

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-secondary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-foreground">{trip.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {dates ? `${dates} · ` : ""}
            {trip.memberCount} {plural(trip.memberCount, "участник", "участника", "участников")}
          </p>
        </div>
        {trip.status === "COMPLETED" && (
          <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
            Завершена
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="text-xs text-muted-foreground">Всего потрачено</p>
          <Money amountMinor={trip.totalMinor} currency={trip.currency} />
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{balanceLabel(trip.myNetMinor)}</p>
          <Money amountMinor={trip.myNetMinor} currency={trip.currency} tone="auto" />
        </div>
      </div>
    </Link>
  );
}

function balanceLabel(netMinor: number): string {
  if (netMinor > 0) return "Вам должны";
  if (netMinor < 0) return "Вы должны";
  return "Вы в расчёте";
}
