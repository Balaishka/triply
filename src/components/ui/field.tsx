import type { ComponentProps, ReactNode, SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/** Общий вид поля ввода: им же одевается кнопка календаря, чтобы поля совпадали. */
export const CONTROL = cn(
  "h-11 w-full rounded-lg border border-input bg-card px-3",
  // 16px — ниже этого размера Safari на айфоне зумит страницу при фокусе.
  "text-base text-foreground placeholder:text-muted-foreground",
  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

// Пропсы вместе с `ref`: поле со ссылкой-приглашением выделяет себя само, если
// браузер не дал скопировать её в буфер.
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  // Нативный select: на телефоне он открывает системный выбор, с которым не
  // сравнится ни один самописный выпадающий список.
  return <select className={cn(CONTROL, "appearance-none pr-8", className)} {...props} />;
}

export function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("text-sm font-semibold text-foreground", className)}>
      {children}
    </label>
  );
}

/** Подпись, поле и место под ошибку — чтобы форма не прыгала при её появлении. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Хорошая новость формы: сохранили, отправили, изменили. */
export function FormSuccess({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-lg bg-secondary/40 px-3 py-2 text-sm font-semibold text-foreground">
      {children}
    </p>
  );
}

/** Общая ошибка формы — то, что не привязано к конкретному полю. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
      {children}
    </p>
  );
}
