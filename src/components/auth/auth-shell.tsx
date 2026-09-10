import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Экран без приложения вокруг: вход, регистрация, ссылки из писем.
 *
 * Живёт отдельным компонентом, а не в разметке `(auth)/layout.tsx`, потому что
 * подтверждение почты лежит вне этой группы — туда приходят и вошедшие, которых
 * `(auth)` разворачивает на главную.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-1 block text-center text-3xl font-extrabold tracking-tight text-primary">
          Triply
        </Link>
        <p className="mb-7 text-center text-sm text-muted-foreground">
          Считайте закаты, а не чеки
        </p>
        {children}
      </div>
    </div>
  );
}
