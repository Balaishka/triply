"use client";

import { useActionState, useRef, useState, useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Field, FormError, Input } from "@/components/ui/field";
import {
  changeEmailAction,
  changePasswordAction,
  removeAvatarAction,
  updateProfileAction,
  uploadAvatarAction,
} from "@/lib/actions/profile";
import { todayISO } from "@/lib/dates";

function Success({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p className="rounded-lg bg-secondary/40 px-3 py-2 text-sm font-semibold text-foreground">
      {children}
    </p>
  );
}

export function AvatarForm({
  nickname,
  avatarUrl,
}: {
  nickname: string;
  avatarUrl: string | null;
}) {
  const [state, action, pending] = useActionState(uploadAvatarAction, null);
  const [removing, startRemoving] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Avatar name={nickname} src={avatarUrl} size="lg" />
        <div className="flex flex-col gap-2">
          <form ref={formRef} action={action}>
            <input
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp,image/avif"
              // Отправляем сразу после выбора файла: отдельная кнопка «загрузить»
              // здесь лишний шаг — выбор файла и есть подтверждение.
              onChange={() => formRef.current?.requestSubmit()}
              disabled={pending}
              className="max-w-[15rem] text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground"
            />
          </form>

          {avatarUrl && (
            <button
              type="button"
              disabled={removing}
              onClick={() => startRemoving(() => void removeAvatarAction())}
              className="w-fit text-sm font-semibold text-muted-foreground underline underline-offset-2 hover:text-destructive"
            >
              {removing ? "Убираем…" : "Убрать аватарку"}
            </button>
          )}
        </div>
      </div>

      {pending && <p className="text-sm text-muted-foreground">Загружаем…</p>}
      <FormError>{state?.error}</FormError>
    </section>
  );
}

export function ProfileForm({
  initial,
}: {
  initial: { nickname: string; birthDate: string; phone: string };
}) {
  const [state, action, pending] = useActionState(updateProfileAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError>{state?.error}</FormError>
      <Success>{state?.success}</Success>

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

export function EmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(changeEmailAction, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Почта</p>
        <p className="text-sm text-muted-foreground">{email} — по ней вы входите.</p>
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
      <Success>{state?.success}</Success>

      <Field
        label="Новая почта"
        htmlFor="newEmail"
        error={state?.fieldErrors?.email}
        hint="Письма для подтверждения мы пока не отправляем — проверьте адрес внимательно."
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
          {pending ? "Меняем…" : "Сменить"}
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
      <Success>{state?.success}</Success>

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
