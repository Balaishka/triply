import type { Metadata } from "next";

import { TripForm } from "@/components/trips/trip-form";
import { createTripAction } from "@/lib/actions/trips";

export const metadata: Metadata = { title: "Новая поездка — Triply" };

export default function NewTripPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Новая поездка</h1>
      <p className="-mt-3 text-sm text-muted-foreground">
        Обязательно только название — даты и участников можно добавить позже.
      </p>
      <TripForm action={createTripAction} submitLabel="Создать" pendingLabel="Создаём…" />
    </div>
  );
}
