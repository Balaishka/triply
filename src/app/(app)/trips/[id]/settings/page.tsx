import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteTripButton } from "@/components/trips/delete-trip-button";
import { MembersManager } from "@/components/trips/members-manager";
import { TripForm } from "@/components/trips/trip-form";
import { BackLink } from "@/components/ui/back-link";
import { updateTripAction } from "@/lib/actions/trips";
import { requireUser } from "@/lib/auth/require-user";
import { toISODate } from "@/lib/dates";
import { getFriends } from "@/lib/queries/friends";
import { getTripDetail } from "@/lib/queries/trips";

export default async function TripSettingsPage({ params }: PageProps<"/trips/[id]/settings">) {
  const { id } = await params;
  const user = await requireUser();
  const trip = await getTripDetail(id, user.id);
  if (!trip) notFound();

  const friends = await getFriends(user.id);
  const memberUserIds = new Set(
    trip.members.map((member) => member.userId).filter((userId): userId is string => userId !== null),
  );
  const availableFriends = friends.filter((friend) => !memberUserIds.has(friend.userId));

  const canEdit = trip.status === "ACTIVE";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <BackLink href={`/trips/${trip.id}`}>{trip.name}</BackLink>
        <h1 className="text-2xl font-extrabold tracking-tight">Настройки поездки</h1>
      </div>

      {!canEdit && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Поездка завершена. Чтобы что-то изменить, откройте её заново на странице{" "}
          <Link
            href={`/trips/${trip.id}/summary`}
            className="font-semibold text-primary underline underline-offset-2"
          >
            итогов
          </Link>
          .
        </p>
      )}

      {canEdit && (
        <TripForm
          action={updateTripAction.bind(null, trip.id)}
          initial={{
            name: trip.name,
            startDate: trip.startDate ? toISODate(trip.startDate) : "",
            endDate: trip.endDate ? toISODate(trip.endDate) : "",
            currency: trip.currency,
          }}
          submitLabel="Сохранить"
          pendingLabel="Сохраняем…"
        />
      )}

      <MembersManager
        tripId={trip.id}
        members={trip.members}
        availableFriends={availableFriends}
        canEdit={canEdit}
      />

      {trip.isCreator && <DeleteTripButton tripId={trip.id} tripName={trip.name} />}
    </div>
  );
}
