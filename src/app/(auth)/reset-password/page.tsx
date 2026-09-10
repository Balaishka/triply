import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/auth-form";
import { LinkButton } from "@/components/ui/link-button";
import { findPasswordReset } from "@/lib/auth/password-reset";

export const metadata: Metadata = { title: "Новый пароль — Triply" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";

  // Ссылку проверяем до показа формы: узнать, что она протухла, лучше сразу,
  // чем после придумывания нового пароля.
  const reset = value ? await findPasswordReset(value) : null;

  if (!reset) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-center">
        <p className="font-semibold text-foreground">Ссылка не работает</p>
        <p className="text-sm text-muted-foreground">
          Она живёт всего час и срабатывает один раз. Запросите новую — это быстро.
        </p>
        <LinkButton href="/forgot-password" className="mx-auto">
          Прислать новую ссылку
        </LinkButton>
      </div>
    );
  }

  return <ResetPasswordForm token={value} />;
}
