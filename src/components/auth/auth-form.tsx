"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FormError, FormSuccess, Input } from "@/components/ui/field";
import {
  confirmEmailChangeAction,
  loginAction,
  registerAction,
  requestPasswordResetAction,
  resetPasswordAction,
} from "@/lib/actions/auth";
import { DEFAULT_AFTER_LOGIN } from "@/lib/auth/next-path";

/** Переброс адреса возврата на соседнюю форму: со входа на регистрацию и обратно. */
function withNext(path: string, next: string): string {
  return next === DEFAULT_AFTER_LOGIN ? path : `${path}?next=${encodeURIComponent(next)}`;
}

/**
 * Вход и регистрация умеют возвращать человека туда, откуда его увели: по
 * ссылке-приглашению приходят без сессии, и поездка не должна теряться по
 * дороге. Куда именно — решает `safeNextPath` на сервере, здесь адрес только
 * едет следом.
 */
export function LoginForm({ notice, next = DEFAULT_AFTER_LOGIN }: { notice?: string; next?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <FormError>{state?.error}</FormError>
      <FormSuccess>{notice}</FormSuccess>
      <input type="hidden" name="next" value={next} />

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
        <Link href={withNext("/register", next)} className="font-semibold text-primary underline underline-offset-2">
          Зарегистрироваться
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next = DEFAULT_AFTER_LOGIN }: { next?: string }) {
  const [state, action, pending] = useActionState(registerAction, null);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <FormError>{state?.error}</FormError>
      <input type="hidden" name="next" value={next} />

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
        <Link href={withNext("/login", next)} className="font-semibold text-primary underline underline-offset-2">
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

/**
 * Подтверждение нового адреса.
 *
 * Адрес меняет кнопка, а не открытие страницы: по ссылкам в письмах ходят
 * почтовые клиенты и антивирусы, и смена, привязанная к самому переходу,
 * случалась бы без человека.
 */
export function ConfirmEmailForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(confirmEmailChangeAction, null);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <FormError>{state?.error}</FormError>

      <input type="hidden" name="token" value={token} />

      <p className="text-sm text-muted-foreground">
        Подтвердите, что дальше вход в Triply будет по адресу
      </p>
      <p className="font-semibold break-all">{email}</p>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Подтверждаем…" : "Подтвердить адрес"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Не меняли почту?{" "}
        <Link href="/profile" className="font-semibold text-primary underline underline-offset-2">
          Отмените смену в профиле
        </Link>
      </p>
    </form>
  );
}
