import { BackLink } from "@/components/ui/back-link";
import { formatDateRange } from "@/lib/dates";
import { plural } from "@/lib/plural";
import type { TripDetail } from "@/lib/queries/trips";

export function TripHeader({ trip }: { trip: TripDetail }) {
  const dates = formatDateRange(trip.startDate, trip.endDate);

  return (
    <div className="flex flex-col gap-1">
      <BackLink href="/">Все поездки</BackLink>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">{trip.name}</h1>
        {trip.status === "COMPLETED" && (
          <span className="mt-1 shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
            Завершена
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {dates ? `${dates} · ` : ""}
        {trip.members.length}{" "}
        {plural(trip.members.length, "участник", "участника", "участников")}
      </p>
    </div>
  );
}
