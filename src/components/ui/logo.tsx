import { cn } from "@/lib/cn";

const SIZES = {
  sm: { mark: 26, text: "text-lg" },
  md: { mark: 34, text: "text-2xl" },
  lg: { mark: 44, text: "text-3xl" },
} as const;

/**
 * Логотип: знак слева, название справа.
 *
 * Название — обычный текст, а не часть картинки: тогда оно рисуется тем же
 * Manrope, что и остальной интерфейс, и остаётся чётким на любом экране.
 * Файлы `public/logo.svg` и `public/logo-mark.svg` — для тех мест, где React
 * не работает: письма и соцсети. Иконка вкладки — `src/app/icon.svg`, знак там
 * нарисован толще: в 16 пикселей фирменная тонкая обводка исчезает.
 */
export function Logo({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={SIZES[size].mark} />
      <span className={cn("font-extrabold tracking-tight text-primary", SIZES[size].text)}>
        Triply
      </span>
    </span>
  );
}

/**
 * Только знак — треугольник из трёх точек: поездка, которую делят на троих.
 */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="200 100 400 370"
      width={(size * 400) / 370}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <g stroke="var(--primary)" strokeWidth={8} strokeLinecap="round">
        <line x1="400" y1="150" x2="250" y2="420" />
        <line x1="400" y1="150" x2="550" y2="420" />
        <line x1="250" y1="420" x2="550" y2="420" />
      </g>
      <circle cx="400" cy="150" r="50" fill="var(--accent)" />
      <circle cx="250" cy="420" r="50" fill="var(--secondary)" />
      <circle cx="550" cy="420" r="50" fill="var(--secondary)" />
    </svg>
  );
}
