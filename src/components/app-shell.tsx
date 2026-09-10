import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Каркас страниц для вошедшего пользователя.
 *
 * Навигация внизу: приложение рассчитано в первую очередь на телефон, а нижняя
 * панель — единственное место, куда большой палец дотягивается без перехвата.
 * На широком экране она уезжает в шапку.
 */
export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label="Triply">
            <Logo size="sm" />
          </Link>

          <nav className="hidden gap-1 sm:flex">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <Link href="/profile" aria-label="Профиль">
            <Avatar name={user.nickname} src={user.avatarUrl} size="sm" />
          </Link>
        </div>
      </header>

      {/* Отступ снизу — под нижнюю панель, чтобы она не накрывала последнюю строку. */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-24 sm:pb-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background sm:hidden">
        <div className="mx-auto flex max-w-3xl">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold text-foreground"
            >
              <TabIcon name={tab.icon} />
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

const TABS = [
  { href: "/", label: "Поездки", icon: "trips" as const },
  { href: "/friends", label: "Друзья", icon: "friends" as const },
  { href: "/profile", label: "Профиль", icon: "profile" as const },
];

function TabIcon({ name }: { name: "trips" | "friends" | "profile" }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "trips") {
    return (
      <svg {...common}>
        <path d="M4 7h16v12H4z" />
        <path d="M9 7V5h6v2" />
      </svg>
    );
  }

  if (name === "friends") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
        <path d="M16 11a3 3 0 1 0-1.5-5.6" />
        <path d="M18 20c0-2.2-.9-3.6-2.2-4.5" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
    </svg>
  );
}
