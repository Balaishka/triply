"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormError, FormSuccess, Input } from "@/components/ui/field";
import {
  loginAction,
  registerAction,
  requestPasswordResetAction,
  resetPasswordAction,
} from "@/lib/actions/auth";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <FormError>{state?.error}</FormError>
      <FormSuccess>{notice}</FormSuccess>

      <Field label="Почта" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Пароль" htmlFor="password" error={state?.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>

      <Link
        href="/forgot-password"
        className="-mt-2 w-fit text-sm font-semibold text-muted-foreground underline underline-offset-2"
      >
        Забыли пароль?
      </Link>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Входим…" : "Войти"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Ещё нет аккаунта?{" "}
        <Link href="/register" className="font-semibold text-primary underline underline-offset-2">
          Зарегистрироваться
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, null);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <FormError>{state?.error}</FormError>

      <Field label="Никнейм" htmlFor="nickname" error={state?.fieldErrors?.nickname}
        hint="По нему вас найдут друзья">
        <Input id="nickname" name="nickname" autoComplete="nickname" required />
      </Field>

      <Field label="Почта" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Пароль" htmlFor="password" error={state?.fieldErrors?.password} hint="Минимум 8 символов">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Создаём…" : "Создать аккаунт"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-semibold text-primary underline underline-offset-2">
          Войти
        </Link>
      </p>
    </form>
  );
}

/**
 * Заявка на восстановление.
 *
 * Ответ один и тот же при любом адресе, поэтому форма после отправки не
 * исчезает: человек мог ошибиться в почте и должен иметь возможность
 * попробовать ещё раз, не возвращаясь назад.
 */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <FormError>{state?.error}</FormError>
      <FormSuccess>{state?.success}</FormSuccess>

      <p className="text-sm text-muted-foreground">
        Пришлём на почту ссылку, по которой можно задать новый пароль.
      </p>

      <Field label="Почта" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Отправляем…" : "Прислать ссылку"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-primary underline underline-offset-2">
          Вернуться ко входу
        </Link>
      </p>
    </form>
  );
}

/** Новый пароль по ссылке из письма. */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <FormError>{state?.error}</FormError>

      <input type="hidden" name="token" value={token} />

      <Field
        label="Новый пароль"
        htmlFor="password"
        error={state?.fieldErrors?.password}
        hint="Минимум 8 символов"
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
        />
      </Field>

      <p className="text-sm text-muted-foreground">
        После смены пароля на всех устройствах придётся войти заново.
      </p>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Сохраняем…" : "Сохранить пароль"}
      </Button>
    </form>
  );
}
