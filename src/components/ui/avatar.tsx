import { AVATAR_COLORS, avatarById, type AvatarPreset } from "@/lib/avatars";
import { cn } from "@/lib/cn";

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
} as const;

export type AvatarSize = keyof typeof SIZES;

/**
 * Аватарка: выбранная картинка из набора или инициалы.
 *
 * Инициалы — не заглушка на время, а полноправный вариант: у гостя без аккаунта
 * выбора нет и не будет. Поэтому цвет подложки берётся из той же палитры, что и
 * у картинок, и выводится из имени — у каждого участника он свой и постоянный,
 * в списке из шести человек это различает их быстрее, чем чтение подписей.
 */
export function Avatar({
  name,
  avatar,
  size = "md",
  className,
}: {
  name: string;
  avatar?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const preset = avatarById(avatar);

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-primary-foreground",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: preset?.color ?? colorFor(name) }}
    >
      {preset ? <AvatarGlyph preset={preset} /> : initials(name)}
    </span>
  );
}

/** Рисунок аватарки. Отдельно от кружка: тот же контур нужен и в выборе. */
export function AvatarGlyph({ preset }: { preset: AvatarPreset }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[62%]"
    >
      {preset.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
