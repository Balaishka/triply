import type { ReactNode } from "react";

import { AuthShell } from "@/components/auth/auth-shell";

/**
 * Вокруг приглашения — тот же экран без приложения, что у входа и подтверждения
 * почты: сюда приходят и без сессии, и нижней навигации приложения показывать
 * нечего, пока человек в него не попал.
 */
export default function JoinLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
