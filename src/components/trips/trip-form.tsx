"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import type { FormState } from "@/lib/actions/form-state";
import { CURRENCY_LIST, DEFAULT_CURRENCY } from "@/lib/money";

export interface TripFormValues {
  name: string;
  startDate: string;
  endDate: string;
  currency: string;
}

const EMPTY: TripFormValues = {
  name: "",
  startDate: "",
  endDate: "",
  currency: DEFAULT_CURRENCY,
};

export function TripForm({
  action,
  initial = EMPTY,
  submitLabel,
  pendingLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: TripFormValues;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError>{state?.error}</FormError>

      <Field label="Название" htmlFor="name" error={state?.fieldErrors?.name}>
        <Input
          id="name"
          name="name"
          defaultValue={initial.name}
          placeholder="Грузия в июле"
          required
          autoFocus={!initial.name}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Начало" htmlFor="startDate" error={state?.fieldErrors?.startDate}>
          <DateInput id="startDate" name="startDate" defaultValue={initial.startDate} />
        </Field>
        <Field label="Конец" htmlFor="endDate" error={state?.fieldErrors?.endDate}>
          <DateInput id="endDate" name="endDate" defaultValue={initial.endDate} />
        </Field>
      </div>

      <Field
        label="Валюта"
        htmlFor="currency"
        error={state?.fieldErrors?.currency}
        hint="Все расходы поездки считаются в одной валюте"
      >
        <Select id="currency" name="currency" defaultValue={initial.currency}>
          {CURRENCY_LIST.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} — {currency.label}
            </option>
          ))}
        </Select>
      </Field>

      <Button type="submit" size="lg" variant="accent" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
