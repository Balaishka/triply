"use client";

import { ConfirmAction } from "@/components/ui/confirm-action";
import { deleteTripAction } from "@/lib/actions/trips";

export function DeleteTripButton({ tripId, tripName }: { tripId: string; tripName: string }) {
  return (
    <div className="border-t border-border pt-5">
      <ConfirmAction
        label="Удалить поездку"
        question={`Удалить «${tripName}» со всеми расходами? Это нельзя отменить, и данные пропадут у всех участников.`}
        confirmLabel="Удалить навсегда"
        action={deleteTripAction.bind(null, tripId)}
      />
    </div>
  );
}
