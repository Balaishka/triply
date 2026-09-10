import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Вход — Triply" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Сюда приводит успешная смена пароля по ссылке из письма.
  const { reset } = await searchParams;

  return (
    <LoginForm
      notice={reset ? "Пароль изменён. Войдите с новым паролем." : undefined}
    />
  );
}
