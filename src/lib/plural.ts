/**
 * Русское склонение по числу: 1 участник, 2 участника, 5 участников.
 *
 * Английское `count === 1 ? x : xs` здесь не работает, а без склонения
 * интерфейс выглядит машинным переводом.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
