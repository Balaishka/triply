import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = { title: "Вход — Triply" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Сюда приводят ссылки из писем: смена пароля и подтверждение новой почты.
  // Во втором случае человек мог подтверждать из чужого браузера, где сессии
  // нет, — ему важно узнать, что входить теперь по новому адресу.
  const { reset, email, next } = await searchParams;

  const notice = reset
    ? "Пароль изменён. Войдите с новым паролем."
    : email
      ? "Адрес подтверждён. Входите по новой почте."
      : undefined;

  return <LoginForm notice={notice} next={safeNextPath(next)} />;
}
