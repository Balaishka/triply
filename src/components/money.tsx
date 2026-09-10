import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

type Tone = "neutral" | "auto" | "muted";

/**
 * Сумма денег.
 *
 * `tone="auto"` красит по знаку: зелёным то, что вам должны, оранжевым — то,
 * что должны вы. Знак при этом не показываем: «−1 200 ₽» рядом со словом
 * «должен» читается как двойное отрицание.
 */
export function Money({
  amountMinor,
  currency,
  tone = "neutral",
  className,
}: {
  amountMinor: number;
  currency: string;
  tone?: Tone;
  className?: string;
}) {
  const color =
    tone === "muted"
      ? "text-muted-foreground"
      : tone === "auto"
        ? amountMinor > 0
          ? "text-owed"
          : amountMinor < 0
            ? "text-owe"
            : "text-muted-foreground"
        : "text-foreground";

  return (
    <span className={cn("tabular font-semibold", color, className)}>
      {formatMoney(tone === "auto" ? Math.abs(amountMinor) : amountMinor, currency)}
    </span>
  );
}
