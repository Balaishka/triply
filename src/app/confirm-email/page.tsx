import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ConfirmEmailForm } from "@/components/auth/auth-form";
import { LinkButton } from "@/components/ui/link-button";
import { findEmailChange } from "@/lib/auth/email-change";

export const metadata: Metadata = { title: "Подтверждение почты — Triply" };

/**
 * Страница вне групп `(app)` и `(auth)`.
 *
 * Ссылку открывают в том ящике, куда переезжает вход: браузер там может быть
 * чужой и без сессии, а может быть и свой, с открытым приложением. `(auth)`
 * развернул бы вошедшего на главную, `(app)` — выставил бы гостя на вход.
 */
export default async function ConfirmEmailPage({ searchParams }: PageProps<"/confirm-email">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";

  // Заявку проверяем до показа кнопки: узнать, что ссылка протухла, лучше
  // сразу — и заодно есть что показать в подтверждении, кроме слова «адрес».
  const request = value ? await findEmailChange(value) : null;

  if (!request) {
    return (
      <AuthShell>
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-center">
          <p className="font-semibold text-foreground">Ссылка не работает</p>
          <p className="text-sm text-muted-foreground">
            Она живёт всего час и срабатывает один раз. Начните смену почты заново — в профиле.
          </p>
          <LinkButton href="/profile" className="mx-auto">
            В профиль
          </LinkButton>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <ConfirmEmailForm token={value} email={request.newEmail} />
    </AuthShell>
  );
}
