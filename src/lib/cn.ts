/** Склейка классов: убирает пустые ветки условий, чтобы не городить тернарники в JSX. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
