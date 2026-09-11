import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = { title: "Регистрация — Triply" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  // Сюда приводит приглашение в поездку: аккаунт заводят ради неё, и после
  // регистрации человек должен оказаться там, а не на пустой главной.
  const { next } = await searchParams;

  return <RegisterForm next={safeNextPath(next)} />;
}
