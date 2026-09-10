import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "accent" | "outline";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  accent: "bg-accent text-accent-foreground hover:bg-accent/90",
  outline: "border border-border bg-card text-foreground hover:bg-muted",
};

/**
 * Ссылка, выглядящая как кнопка.
 *
 * Отдельный компонент, а не `Button` с вложенной ссылкой: переход — это ссылка,
 * и она должна открываться в новой вкладке средним кликом, как любая другая.
 */
export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
