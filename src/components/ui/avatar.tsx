import { cn } from "@/lib/cn";

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
} as const;

/**
 * Аватарка с запасным вариантом из инициалов.
 *
 * Цвет подложки выводится из имени, поэтому у каждого участника он свой и
 * постоянный — в списке из шести человек это помогает различать их быстрее,
 * чем чтение подписей.
 */
export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- аватарки лежат локально и уже нужного размера
      <img
        src={src}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover", SIZES[size], className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-primary-foreground",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: colorFor(name) }}
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

const PALETTE = ["#123c35", "#1f6b57", "#3f7d6a", "#b8431a", "#8a6a3b", "#4a5d78"];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
