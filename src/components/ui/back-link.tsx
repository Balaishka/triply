import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Ссылка «назад» с шевроном.
 *
 * Отдельный компонент, потому что таких ссылок пять и они должны выглядеть
 * одинаково: иконка нарисована линиями, как остальные в приложении, а не
 * набрана типографским символом со случайной для шрифта шириной.
 */
export function BackLink({
  children,
  className,
  ...props
}: ComponentProps<typeof Link> & { children: ReactNode }) {
  return (
    <Link
      className={cn(
        "inline-flex w-fit items-center gap-0.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
      {...props}
    >
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="-ml-0.5 shrink-0"
        aria-hidden
      >
        <path d="M14.5 6.5 9 12l5.5 5.5" />
      </svg>
      {children}
    </Link>
  );
}
