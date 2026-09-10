"use client";

import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Field, FormError, FormSuccess, Input } from "@/components/ui/field";
import {
  cancelEmailChangeAction,
  changeEmailAction,
  changePasswordAction,
  updateProfileAction,
} from "@/lib/actions/profile";
import { todayISO } from "@/lib/dates";

export function ProfileForm({
  initial,
}: {
  initial: { nickname: string; birthDate: string; phone: string };
}) {
  const [state, action, pending] = useActionState(updateProfileAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError>{state?.error}</FormError>
      <FormSuccess>{state?.success}</FormSuccess>

      <Field label="Никнейм" htmlFor="nickname" error={state?.fieldErrors?.nickname}>
        <Input id="nickname" name="nickname" defaultValue={initial.nickname} required />
      </Field>

      <Field label="Дата рождения" htmlFor="birthDate" error={state?.fieldErrors?.birthDate}>
        {/* Родиться в будущем нельзя, а нижняя граница просто держит выбор года
            в разумных пределах. */}
        <DateInput
          id="birthDate"
          name="birthDate"
          defaultValue={initial.birthDate}
          min="1900-01-01"
          max={todayISO()}
        />
      </Field>

      <Field label="Телефон" htmlFor="phone" error={state?.fieldErrors?.phone}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={initial.phone}
          placeholder="+7 900 000-00-00"
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Сохраняем…" : "Сохранить"}
      </Button>
    </form>
  );
}

/**
 * Почта.
 *
 * Новый адрес становится входом не здесь, а после перехода по ссылке из
 * письма, поэтому у формы есть третье состояние помимо «свёрнута» и «открыта»:
 * ожидание подтверждения. Без него отправленное письмо выглядело бы так, будто
 * смена не сработала.
 */
export function EmailForm({
  email,
  pendingEmail,
  notice,
}: {
  email: string;
  pendingEmail: string | null;
  notice?: string;
}) {
  const [state, action, pending] = useActionState(changeEmailAction, null);
  const [open, setOpen] = useState(false);
  const [cancelling, startCancelling] = useTransition();

  const waiting = pendingEmail && (
    <div className="flex flex-col items-start gap-2 rounded-lg bg-secondary/40 px-3 py-2 text-sm">
      <p>
        Ждём подтверждения на <span className="font-semibold break-all">{pendingEmail}</span>. Пока
        не перейдёте по ссылке из письма, вход остаётся прежним.
      </p>
      <button
        type="button"
        disabled={cancelling}
        onClick={() => startCancelling(() => void cancelEmailChangeAction())}
        className="font-semibold text-muted-foreground underline underline-offset-2 hover:text-destructive"
      >
        {cancelling ? "Отменяем…" : "Отменить смену"}
      </button>
    </div>
  );

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Почта</p>
        <p className="text-sm text-muted-foreground">{email} — по ней вы входите.</p>
        <FormSuccess>{notice}</FormSuccess>
        {waiting}
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => setOpen(true)}
        >
          Сменить почту
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <FormError>{state?.error}</FormError>
      <FormSuccess>{state?.success}</FormSuccess>
      {waiting}

      <Field
        label="Новая почта"
        htmlFor="newEmail"
        error={state?.fieldErrors?.email}
        hint="Пришлём на этот адрес письмо со ссылкой — вход сменится после перехода по ней."
      >
        <Input id="newEmail" name="email" type="email" defaultValue={email} required />
      </Field>

      <Field
        label="Ваш пароль"
        htmlFor="emailPassword"
        error={state?.fieldErrors?.currentPassword}
      >
        <Input
          id="emailPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Отправляем…" : "Прислать письмо"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Сменить пароль
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <FormError>{state?.error}</FormError>
      <FormSuccess>{state?.success}</FormSuccess>

      <Field
        label="Текущий пароль"
        htmlFor="currentPassword"
        error={state?.fieldErrors?.currentPassword}
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field
        label="Новый пароль"
        htmlFor="newPassword"
        error={state?.fieldErrors?.newPassword}
        hint="Минимум 8 символов"
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Меняем…" : "Сменить"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
