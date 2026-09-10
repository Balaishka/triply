"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/field";
import { loginAction, registerAction } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <FormError>{state?.error}</FormError>

      <Field label="Почта" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Пароль" htmlFor="password" error={state?.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>

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
